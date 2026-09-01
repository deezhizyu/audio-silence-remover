import type { VideoContainerFormat } from '../decideOutputContainerFormat';
import type { SerializedAmplitudeEnvelope } from './workerMessages';

export type AudioAlignmentWorkerRequest =
  | { type: 'loadVideoSource'; requestId: number; videoFile: File }
  | { type: 'loadVoiceChangedSource'; requestId: number; audioFile: File }
  | { type: 'exportAlignedVideo'; requestId: number; volumeThresholdPercent: number; cutEdgeSilenceEnabled: boolean };

export type AudioAlignmentWorkerResponse =
  | { type: 'loadVideoSource'; requestId: number; envelope: SerializedAmplitudeEnvelope; durationSeconds: number }
  | { type: 'loadVoiceChangedSource'; requestId: number; envelope: SerializedAmplitudeEnvelope; durationSeconds: number }
  | { type: 'exportAlignedVideo'; requestId: number; fileBytes: ArrayBuffer; containerFormat: VideoContainerFormat }
  | { type: 'error'; requestId: number; message: string };
