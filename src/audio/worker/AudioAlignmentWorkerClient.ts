import type { VideoContainerFormat } from '../decideOutputContainerFormat';
import type { AudioAlignmentWorkerRequest, AudioAlignmentWorkerResponse } from './audioAlignmentWorkerMessages';
import type { SerializedAmplitudeEnvelope } from './workerMessages';

export interface LoadVideoSourceResult {
  envelope: SerializedAmplitudeEnvelope;
  durationSeconds: number;
}

export interface LoadVoiceChangedSourceResult {
  envelope: SerializedAmplitudeEnvelope;
  durationSeconds: number;
  channelData: Float32Array<ArrayBuffer>[];
  sampleRate: number;
}

export interface ExportAlignedVideoResult {
  fileBytes: ArrayBuffer;
  containerFormat: VideoContainerFormat;
}

/** Thin promise-based wrapper around the audio alignment Web Worker; one instance per alignment session. */
export class AudioAlignmentWorkerClient {
  private readonly worker: Worker;
  private nextRequestId = 0;
  private readonly pendingRequests = new Map<
    number,
    { resolve: (response: AudioAlignmentWorkerResponse) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(new URL('./audioAlignmentWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<AudioAlignmentWorkerResponse>) => this.handleResponse(event.data);
  }

  private handleResponse(response: AudioAlignmentWorkerResponse): void {
    const pendingRequest = this.pendingRequests.get(response.requestId);
    if (!pendingRequest) return;
    this.pendingRequests.delete(response.requestId);

    if (response.type === 'error') {
      pendingRequest.reject(new Error(response.message));
    } else {
      pendingRequest.resolve(response);
    }
  }

  private sendRequest(request: AudioAlignmentWorkerRequest, transferables: Transferable[] = []): Promise<AudioAlignmentWorkerResponse> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.requestId, { resolve, reject });
      this.worker.postMessage(request, transferables);
    });
  }

  async loadVideoSource(videoFile: File): Promise<LoadVideoSourceResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'loadVideoSource', requestId, videoFile });
    if (response.type !== 'loadVideoSource') throw new Error('Unexpected response to loadVideoSource.');
    return { envelope: response.envelope, durationSeconds: response.durationSeconds };
  }

  async loadVoiceChangedSource(audioFile: File): Promise<LoadVoiceChangedSourceResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'loadVoiceChangedSource', requestId, audioFile });
    if (response.type !== 'loadVoiceChangedSource') throw new Error('Unexpected response to loadVoiceChangedSource.');
    return {
      envelope: response.envelope,
      durationSeconds: response.durationSeconds,
      channelData: response.channelData,
      sampleRate: response.sampleRate,
    };
  }

  async exportAlignedVideo(offsetSeconds: number, trimStartSeconds: number, trimEndSeconds: number): Promise<ExportAlignedVideoResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'exportAlignedVideo', requestId, offsetSeconds, trimStartSeconds, trimEndSeconds });
    if (response.type !== 'exportAlignedVideo') throw new Error('Unexpected response to exportAlignedVideo.');
    return { fileBytes: response.fileBytes, containerFormat: response.containerFormat };
  }

  terminate(): void {
    this.worker.terminate();
    this.pendingRequests.clear();
  }
}
