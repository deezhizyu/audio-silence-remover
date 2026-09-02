import type { SerializedAmplitudeEnvelope } from './workerMessages';

export interface AlignmentBatchPairInput {
  baseName: string;
  videoFile: File;
  audioFile: File;
}

export interface AlignmentBatchPairFailure {
  baseName: string;
  message: string;
}

export type AudioAlignmentWorkerRequest =
  | { type: 'loadReferencePair'; requestId: number; videoFile: File; audioFile: File }
  | { type: 'exportBatch'; requestId: number; pairs: AlignmentBatchPairInput[]; offsetSeconds: number };

export type AudioAlignmentWorkerResponse =
  | {
      type: 'loadReferencePair';
      requestId: number;
      originalVideoEnvelope: SerializedAmplitudeEnvelope;
      voiceChangedAudioEnvelope: SerializedAmplitudeEnvelope;
      voiceChangedChannelData: Float32Array<ArrayBuffer>[];
      voiceChangedSampleRate: number;
    }
  | { type: 'exportBatchProgress'; requestId: number; completed: number; total: number; baseName: string }
  | { type: 'exportBatch'; requestId: number; zipFileBytes: ArrayBuffer; failures: AlignmentBatchPairFailure[] }
  | { type: 'error'; requestId: number; message: string };
