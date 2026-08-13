import { computeAmplitudeEnvelope, type AmplitudeEnvelope } from '../computeAmplitudeEnvelope';
import { computeDefaultDetectionConfig } from '../computeDefaultDetectionConfig';
import { cutSilenceRegions } from '../cutSilenceRegions';
import { detectSilenceRegions } from '../detectSilenceRegions';
import type { WorkerRequest, WorkerResponse } from './workerMessages';

/** The worker owns the decoded PCM data for the session so it never has to be re-copied across the postMessage boundary. */
let retainedChannelData: Float32Array<ArrayBuffer>[] = [];
let retainedSampleRate = 0;
let retainedEnvelope: AmplitudeEnvelope | null = null;

function respond(response: WorkerResponse, transferables: Transferable[] = []): void {
  self.postMessage(response, { transfer: transferables });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'loadAudio': {
        retainedChannelData = request.channelData;
        retainedSampleRate = request.sampleRate;
        retainedEnvelope = computeAmplitudeEnvelope(retainedChannelData, retainedSampleRate);
        const defaultConfig = computeDefaultDetectionConfig(retainedEnvelope);

        // A copy (not a transfer) is sent here: the worker keeps its own envelope around to answer
        // subsequent `detectRegions` requests without recomputing it on every config change.
        respond({
          type: 'loadAudio',
          requestId: request.requestId,
          envelope: {
            rootMeanSquarePerWindow: retainedEnvelope.rootMeanSquarePerWindow.slice(),
            windowSizeSeconds: retainedEnvelope.windowSizeSeconds,
            peakAmplitude: retainedEnvelope.peakAmplitude,
            durationSeconds: retainedEnvelope.durationSeconds,
          },
          defaultConfig,
        });
        break;
      }

      case 'detectRegions': {
        if (!retainedEnvelope) throw new Error('No audio has been loaded yet.');
        const regions = detectSilenceRegions(retainedEnvelope, request.config);
        respond({ type: 'detectRegions', requestId: request.requestId, regions });
        break;
      }

      case 'cutAudio': {
        if (!retainedEnvelope) throw new Error('No audio has been loaded yet.');
        const trimmedChannelData = cutSilenceRegions(retainedChannelData, retainedSampleRate, request.regions, request.config);
        respond(
          { type: 'cutAudio', requestId: request.requestId, channelData: trimmedChannelData, sampleRate: retainedSampleRate },
          trimmedChannelData.map(channel => channel.buffer),
        );
        break;
      }
    }
  } catch (error) {
    respond({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : String(error) });
  }
};
