import type { VideoContainerFormat } from '../decideOutputContainerFormat';
import type { SerializedAmplitudeEnvelope } from './workerMessages';

export type AudioAlignmentWorkerRequest =
  | { type: 'loadVideoSource'; requestId: number; videoFile: File }
  | { type: 'loadVoiceChangedSource'; requestId: number; audioFile: File }
  | { type: 'exportAlignedVideo'; requestId: number; offsetSeconds: number; trimStartSeconds: number; trimEndSeconds: number };

export type AudioAlignmentWorkerResponse =
  | { type: 'loadVideoSource'; requestId: number; envelope: SerializedAmplitudeEnvelope; durationSeconds: number }
  | {
      type: 'loadVoiceChangedSource';
      requestId: number;
      envelope: SerializedAmplitudeEnvelope;
      durationSeconds: number;
      channelData: Float32Array<ArrayBuffer>[];
      sampleRate: number;
    }
  | { type: 'exportAlignedVideo'; requestId: number; fileBytes: ArrayBuffer; containerFormat: VideoContainerFormat }
  | { type: 'error'; requestId: number; message: string };
