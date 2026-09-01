import type {
  AlignmentBatchPairFailure,
  AlignmentBatchPairInput,
  AudioAlignmentWorkerRequest,
  AudioAlignmentWorkerResponse,
} from './audioAlignmentWorkerMessages';

export interface DecodeReferenceAudioResult {
  channelData: Float32Array<ArrayBuffer>[];
  sampleRate: number;
}

export interface ExportBatchResult {
  zipFileBytes: ArrayBuffer;
  failures: AlignmentBatchPairFailure[];
}

export type ExportBatchProgressCallback = (completed: number, total: number, baseName: string) => void;

interface PendingRequest {
  resolve: (response: AudioAlignmentWorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: ExportBatchProgressCallback;
}

/** Thin promise-based wrapper around the audio alignment Web Worker; one instance per alignment session.
    `exportBatch` is long-running, so the worker also sends non-terminal `exportBatchProgress` messages for
    the same request — those are routed to the caller's progress callback without resolving the promise. */
export class AudioAlignmentWorkerClient {
  private readonly worker: Worker;
  private nextRequestId = 0;
  private readonly pendingRequests = new Map<number, PendingRequest>();

  constructor() {
    this.worker = new Worker(new URL('./audioAlignmentWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<AudioAlignmentWorkerResponse>) => this.handleResponse(event.data);
  }

  private handleResponse(response: AudioAlignmentWorkerResponse): void {
    const pendingRequest = this.pendingRequests.get(response.requestId);
    if (!pendingRequest) return;

    if (response.type === 'exportBatchProgress') {
      pendingRequest.onProgress?.(response.completed, response.total, response.baseName);
      return;
    }

    this.pendingRequests.delete(response.requestId);
    if (response.type === 'error') {
      pendingRequest.reject(new Error(response.message));
    } else {
      pendingRequest.resolve(response);
    }
  }

  private sendRequest(
    request: AudioAlignmentWorkerRequest,
    transferables: Transferable[] = [],
    onProgress?: ExportBatchProgressCallback,
  ): Promise<AudioAlignmentWorkerResponse> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.requestId, { resolve, reject, onProgress });
      this.worker.postMessage(request, transferables);
    });
  }

  async decodeReferenceAudio(audioFile: File): Promise<DecodeReferenceAudioResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'decodeReferenceAudio', requestId, audioFile });
    if (response.type !== 'decodeReferenceAudio') throw new Error('Unexpected response to decodeReferenceAudio.');
    return { channelData: response.channelData, sampleRate: response.sampleRate };
  }

  async exportBatch(pairs: AlignmentBatchPairInput[], offsetSeconds: number, onProgress?: ExportBatchProgressCallback): Promise<ExportBatchResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'exportBatch', requestId, pairs, offsetSeconds }, [], onProgress);
    if (response.type !== 'exportBatch') throw new Error('Unexpected response to exportBatch.');
    return { zipFileBytes: response.zipFileBytes, failures: response.failures };
  }

  terminate(): void {
    this.worker.terminate();
    this.pendingRequests.clear();
  }
}
