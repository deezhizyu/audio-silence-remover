import type { DetectionConfig, SilenceRegion } from '../types';
import type { SerializedAmplitudeEnvelope, WorkerRequest, WorkerResponse } from './workerMessages';

export interface LoadAudioResult {
  envelope: SerializedAmplitudeEnvelope;
  defaultConfig: DetectionConfig;
}

export interface CutAudioResult {
  channelData: Float32Array<ArrayBuffer>[];
  sampleRate: number;
}

/** Thin promise-based wrapper around the audio analysis Web Worker; one instance per loaded file. */
export class AudioAnalysisWorkerClient {
  private readonly worker: Worker;
  private nextRequestId = 0;
  private readonly pendingRequests = new Map<number, { resolve: (response: WorkerResponse) => void; reject: (error: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./audioAnalysisWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleResponse(event.data);
  }

  private handleResponse(response: WorkerResponse): void {
    const pendingRequest = this.pendingRequests.get(response.requestId);
    if (!pendingRequest) return;
    this.pendingRequests.delete(response.requestId);

    if (response.type === 'error') {
      pendingRequest.reject(new Error(response.message));
    } else {
      pendingRequest.resolve(response);
    }
  }

  private sendRequest(request: WorkerRequest, transferables: Transferable[] = []): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.requestId, { resolve, reject });
      this.worker.postMessage(request, transferables);
    });
  }

  async loadAudio(channelData: Float32Array<ArrayBuffer>[], sampleRate: number): Promise<LoadAudioResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest(
      { type: 'loadAudio', requestId, channelData, sampleRate },
      channelData.map(channel => channel.buffer),
    );
    if (response.type !== 'loadAudio') throw new Error('Unexpected response to loadAudio.');
    return { envelope: response.envelope, defaultConfig: response.defaultConfig };
  }

  async detectRegions(config: DetectionConfig): Promise<SilenceRegion[]> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'detectRegions', requestId, config });
    if (response.type !== 'detectRegions') throw new Error('Unexpected response to detectRegions.');
    return response.regions;
  }

  async cutAudio(regions: SilenceRegion[], config: DetectionConfig): Promise<CutAudioResult> {
    const requestId = this.nextRequestId++;
    const response = await this.sendRequest({ type: 'cutAudio', requestId, regions, config });
    if (response.type !== 'cutAudio') throw new Error('Unexpected response to cutAudio.');
    return { channelData: response.channelData, sampleRate: response.sampleRate };
  }

  terminate(): void {
    this.worker.terminate();
    this.pendingRequests.clear();
  }
}
