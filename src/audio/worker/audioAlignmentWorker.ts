import { applyEdgeFades } from '../applyEdgeFades';
import { chooseAlignmentEnvelopeWindowSeconds } from '../chooseAlignmentEnvelopeWindowSeconds';
import { computeAmplitudeEnvelope, type AmplitudeEnvelope } from '../computeAmplitudeEnvelope';
import { decideOutputContainerFormat } from '../decideOutputContainerFormat';
import { decodeMediaFileAudioTrack } from '../decodeMediaFileAudioTrack';
import { muxAudioIntoVideoContainer } from '../muxAudioIntoVideoContainer';
import { shiftAndTrimAudioChannels } from '../shiftAndTrimAudioChannels';
import type { AudioAlignmentWorkerRequest, AudioAlignmentWorkerResponse } from './audioAlignmentWorkerMessages';

/** Below this, the result of trimming is too short to be a meaningful export (and too short for the edge fades to make sense). */
const MINIMUM_EXPORTABLE_DURATION_SECONDS = 0.5;

let retainedVideoFile: File | null = null;
let retainedOriginalEnvelope: AmplitudeEnvelope | null = null;

let retainedVoiceChangedChannelData: Float32Array<ArrayBuffer>[] = [];
let retainedVoiceChangedSampleRate = 0;
let retainedVoiceChangedEnvelope: AmplitudeEnvelope | null = null;

function serializeEnvelope(envelope: AmplitudeEnvelope) {
  return {
    rootMeanSquarePerWindow: envelope.rootMeanSquarePerWindow.slice(),
    windowSizeSeconds: envelope.windowSizeSeconds,
    peakAmplitude: envelope.peakAmplitude,
    durationSeconds: envelope.durationSeconds,
  };
}

function respond(response: AudioAlignmentWorkerResponse, transferables: Transferable[] = []): void {
  self.postMessage(response, { transfer: transferables });
}

self.onmessage = (event: MessageEvent<AudioAlignmentWorkerRequest>) => {
  const request = event.data;

  void (async () => {
    try {
      switch (request.type) {
        case 'loadVideoSource': {
          const { channelData, sampleRate, durationSeconds } = await decodeMediaFileAudioTrack(request.videoFile);
          retainedVideoFile = request.videoFile;
          retainedOriginalEnvelope = computeAmplitudeEnvelope(channelData, sampleRate, chooseAlignmentEnvelopeWindowSeconds(durationSeconds));

          respond({
            type: 'loadVideoSource',
            requestId: request.requestId,
            envelope: serializeEnvelope(retainedOriginalEnvelope),
            durationSeconds,
          });
          break;
        }

        case 'loadVoiceChangedSource': {
          const { channelData, sampleRate, durationSeconds } = await decodeMediaFileAudioTrack(request.audioFile);
          retainedVoiceChangedChannelData = channelData;
          retainedVoiceChangedSampleRate = sampleRate;
          retainedVoiceChangedEnvelope = computeAmplitudeEnvelope(channelData, sampleRate, chooseAlignmentEnvelopeWindowSeconds(durationSeconds));

          // The main thread needs the actual PCM to build a playback preview buffer — a fresh copy per
          // channel, transferred zero-copy, so the transfer doesn't detach the arrays retained above for export.
          const channelDataForMainThread = channelData.map(channel => channel.slice());

          respond(
            {
              type: 'loadVoiceChangedSource',
              requestId: request.requestId,
              envelope: serializeEnvelope(retainedVoiceChangedEnvelope),
              durationSeconds,
              channelData: channelDataForMainThread,
              sampleRate,
            },
            channelDataForMainThread.map(channel => channel.buffer),
          );
          break;
        }

        case 'exportAlignedVideo': {
          if (!retainedVideoFile || !retainedOriginalEnvelope || !retainedVoiceChangedEnvelope) {
            throw new Error('Both a video and a voice-changed audio file must be loaded first.');
          }

          const { offsetSeconds, trimStartSeconds, trimEndSeconds } = request;

          let processedChannelData = shiftAndTrimAudioChannels(
            retainedVoiceChangedChannelData,
            retainedVoiceChangedSampleRate,
            offsetSeconds + trimStartSeconds,
            trimEndSeconds,
          );

          const finalDurationSeconds = (processedChannelData[0]?.length ?? 0) / retainedVoiceChangedSampleRate;
          if (finalDurationSeconds < MINIMUM_EXPORTABLE_DURATION_SECONDS) {
            throw new Error('Not enough audio remains after the offset and trims to export — try adjusting them.');
          }

          processedChannelData = applyEdgeFades(processedChannelData, retainedVoiceChangedSampleRate);

          const containerFormat = decideOutputContainerFormat(retainedVideoFile.name);
          const blob = await muxAudioIntoVideoContainer(retainedVideoFile, processedChannelData, retainedVoiceChangedSampleRate, containerFormat);
          const fileBytes = await blob.arrayBuffer();

          respond({ type: 'exportAlignedVideo', requestId: request.requestId, fileBytes, containerFormat }, [fileBytes]);
          break;
        }
      }
    } catch (error) {
      respond({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : String(error) });
    }
  })();
};
