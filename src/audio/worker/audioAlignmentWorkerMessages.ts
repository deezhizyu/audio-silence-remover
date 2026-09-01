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
  | { type: 'decodeReferenceAudio'; requestId: number; audioFile: File }
  | { type: 'exportBatch'; requestId: number; pairs: AlignmentBatchPairInput[]; offsetSeconds: number };

export type AudioAlignmentWorkerResponse =
  | { type: 'decodeReferenceAudio'; requestId: number; channelData: Float32Array<ArrayBuffer>[]; sampleRate: number }
  | { type: 'exportBatchProgress'; requestId: number; completed: number; total: number; baseName: string }
  | { type: 'exportBatch'; requestId: number; zipFileBytes: ArrayBuffer; failures: AlignmentBatchPairFailure[] }
  | { type: 'error'; requestId: number; message: string };
