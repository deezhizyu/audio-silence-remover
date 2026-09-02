import { zipSync } from 'fflate';
import { applyEdgeFades } from '../applyEdgeFades';
import { chooseAlignmentEnvelopeWindowSeconds } from '../chooseAlignmentEnvelopeWindowSeconds';
import { computeAmplitudeEnvelope, type AmplitudeEnvelope } from '../computeAmplitudeEnvelope';
import { decideOutputContainerFormat } from '../decideOutputContainerFormat';
import { decodeMediaFileAudioTrack } from '../decodeMediaFileAudioTrack';
import { deriveAlignedVideoFileName } from '../deriveAlignedVideoFileName';
import { muxAudioIntoVideoContainer } from '../muxAudioIntoVideoContainer';
import { shiftAndTrimAudioChannels } from '../shiftAndTrimAudioChannels';
import type { AlignmentBatchPairFailure, AudioAlignmentWorkerRequest, AudioAlignmentWorkerResponse } from './audioAlignmentWorkerMessages';

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

async function exportOnePair(videoFile: File, audioFile: File, offsetSeconds: number): Promise<Uint8Array> {
  const { channelData, sampleRate } = await decodeMediaFileAudioTrack(audioFile);
  let processedChannelData = shiftAndTrimAudioChannels(channelData, sampleRate, offsetSeconds, 0);
  processedChannelData = applyEdgeFades(processedChannelData, sampleRate);

  const containerFormat = decideOutputContainerFormat(videoFile.name);
  const blob = await muxAudioIntoVideoContainer(videoFile, processedChannelData, sampleRate, containerFormat);
  return new Uint8Array(await blob.arrayBuffer());
}

self.onmessage = (event: MessageEvent<AudioAlignmentWorkerRequest>) => {
  const request = event.data;

  void (async () => {
    try {
      switch (request.type) {
        case 'loadReferencePair': {
          const [video, audio] = await Promise.all([
            decodeMediaFileAudioTrack(request.videoFile),
            decodeMediaFileAudioTrack(request.audioFile),
          ]);

          const originalVideoEnvelope = computeAmplitudeEnvelope(
            video.channelData,
            video.sampleRate,
            chooseAlignmentEnvelopeWindowSeconds(video.durationSeconds),
          );
          const voiceChangedAudioEnvelope = computeAmplitudeEnvelope(
            audio.channelData,
            audio.sampleRate,
            chooseAlignmentEnvelopeWindowSeconds(audio.durationSeconds),
          );

          // A fresh copy, so transferring it to the main thread for the playback buffer doesn't detach
          // anything this worker still needs (nothing here, but matches the pattern used elsewhere).
          const voiceChangedChannelDataCopy = audio.channelData.map(channel => channel.slice());

          respond(
            {
              type: 'loadReferencePair',
              requestId: request.requestId,
              originalVideoEnvelope: serializeEnvelope(originalVideoEnvelope),
              voiceChangedAudioEnvelope: serializeEnvelope(voiceChangedAudioEnvelope),
              voiceChangedChannelData: voiceChangedChannelDataCopy,
              voiceChangedSampleRate: audio.sampleRate,
            },
            voiceChangedChannelDataCopy.map(channel => channel.buffer),
          );
          break;
        }

        case 'exportBatch': {
          const { pairs, offsetSeconds } = request;
          const zipEntries: Record<string, Uint8Array> = {};
          const failures: AlignmentBatchPairFailure[] = [];

          for (let index = 0; index < pairs.length; index++) {
            const pair = pairs[index];
            try {
              const fileBytes = await exportOnePair(pair.videoFile, pair.audioFile, offsetSeconds);
              zipEntries[deriveAlignedVideoFileName(pair.videoFile.name)] = fileBytes;
            } catch (pairError) {
              // One bad pair (an undecodable audio file, a video with no usable track) shouldn't abort the
              // whole batch — record it and keep processing the rest.
              failures.push({ baseName: pair.baseName, message: pairError instanceof Error ? pairError.message : String(pairError) });
            }
            respond({ type: 'exportBatchProgress', requestId: request.requestId, completed: index + 1, total: pairs.length, baseName: pair.baseName });
          }

          // Stored, not compressed: every entry is already a compressed video container, so re-compressing
          // would just burn CPU for no size benefit.
          const zipFileBytes = zipSync(zipEntries, { level: 0 });
          respond({ type: 'exportBatch', requestId: request.requestId, zipFileBytes: zipFileBytes.buffer, failures }, [zipFileBytes.buffer]);
          break;
        }
      }
    } catch (error) {
      respond({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : String(error) });
    }
  })();
};
