import { applyEdgeFades } from '../applyEdgeFades';
import { computeAlignmentTrim } from '../computeAlignmentTrim';
import { computeAmplitudeEnvelope, type AmplitudeEnvelope } from '../computeAmplitudeEnvelope';
import { computeCrossCorrelationOffsetSeconds } from '../computeCrossCorrelationOffsetSeconds';
import { decideOutputContainerFormat } from '../decideOutputContainerFormat';
import { decodeMediaFileAudioTrack } from '../decodeMediaFileAudioTrack';
import { detectEdgeSilenceDurations } from '../detectEdgeSilenceDurations';
import { muxAudioIntoVideoContainer } from '../muxAudioIntoVideoContainer';
import { trimAudioChannels } from '../trimAudioChannels';
import type { AudioAlignmentWorkerRequest, AudioAlignmentWorkerResponse } from './audioAlignmentWorkerMessages';

/** Below this, the result of trimming is too short to be a meaningful export (and too short for the edge fades to make sense). */
const MINIMUM_EXPORTABLE_DURATION_SECONDS = 0.5;

let retainedVideoFile: File | null = null;
let retainedOriginalEnvelope: AmplitudeEnvelope | null = null;
let retainedOriginalAudioDurationSeconds = 0;

let retainedVoiceChangedChannelData: Float32Array<ArrayBuffer>[] = [];
let retainedVoiceChangedSampleRate = 0;
let retainedVoiceChangedEnvelope: AmplitudeEnvelope | null = null;
let retainedVoiceChangedDurationSeconds = 0;

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
          retainedOriginalEnvelope = computeAmplitudeEnvelope(channelData, sampleRate);
          retainedOriginalAudioDurationSeconds = durationSeconds;

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
          retainedVoiceChangedEnvelope = computeAmplitudeEnvelope(channelData, sampleRate);
          retainedVoiceChangedDurationSeconds = durationSeconds;

          respond({
            type: 'loadVoiceChangedSource',
            requestId: request.requestId,
            envelope: serializeEnvelope(retainedVoiceChangedEnvelope),
            durationSeconds,
          });
          break;
        }

        case 'exportAlignedVideo': {
          if (!retainedVideoFile || !retainedOriginalEnvelope || !retainedVoiceChangedEnvelope) {
            throw new Error('Both a video and a voice-changed audio file must be loaded first.');
          }

          const { volumeThresholdPercent, cutEdgeSilenceEnabled } = request;

          // The sync offset comes from correlating the two audio signals directly, not from comparing
          // where each one crosses the volume threshold — see computeCrossCorrelationOffsetSeconds for why.
          const correlationOffsetSeconds = computeCrossCorrelationOffsetSeconds(retainedOriginalEnvelope, retainedVoiceChangedEnvelope);
          const alignmentTrim = computeAlignmentTrim({
            startTrimSeconds: correlationOffsetSeconds,
            originalAudioDurationSeconds: retainedOriginalAudioDurationSeconds,
            voiceChangedDurationSeconds: retainedVoiceChangedDurationSeconds,
          });

          let processedChannelData = trimAudioChannels(
            retainedVoiceChangedChannelData,
            retainedVoiceChangedSampleRate,
            alignmentTrim.startTrimSeconds,
            alignmentTrim.endTrimSeconds,
          );

          // Any further edge-silence trim must happen before the fades below: a fade ramp itself reads as
          // silence, so trimming edge silence after fading would undo the very fade meant to prevent a pop.
          if (cutEdgeSilenceEnabled) {
            const processedEnvelope = computeAmplitudeEnvelope(processedChannelData, retainedVoiceChangedSampleRate);
            const residualEdgeSilence = detectEdgeSilenceDurations(processedEnvelope, volumeThresholdPercent);

            if (residualEdgeSilence.leadingSilenceSeconds + residualEdgeSilence.trailingSilenceSeconds >= processedEnvelope.durationSeconds) {
              throw new Error('The aligned audio is silent throughout — nothing to export.');
            }

            processedChannelData = trimAudioChannels(
              processedChannelData,
              retainedVoiceChangedSampleRate,
              residualEdgeSilence.leadingSilenceSeconds,
              residualEdgeSilence.trailingSilenceSeconds,
            );
          }

          const finalDurationSeconds = (processedChannelData[0]?.length ?? 0) / retainedVoiceChangedSampleRate;
          if (finalDurationSeconds < MINIMUM_EXPORTABLE_DURATION_SECONDS) {
            throw new Error('Not enough audio remains after trimming to export — try a lower silence threshold.');
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
