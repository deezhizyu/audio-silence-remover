import type { DetectionConfig, SilenceRegion } from '../types';

export interface SerializedAmplitudeEnvelope {
  rootMeanSquarePerWindow: Float32Array<ArrayBuffer>;
  windowSizeSeconds: number;
  peakAmplitude: number;
  durationSeconds: number;
}

export type WorkerRequest =
  | { type: 'loadAudio'; requestId: number; channelData: Float32Array<ArrayBuffer>[]; sampleRate: number }
  | { type: 'detectRegions'; requestId: number; config: DetectionConfig }
  | { type: 'cutAudio'; requestId: number; regions: SilenceRegion[]; config: DetectionConfig };

export type WorkerResponse =
  | { type: 'loadAudio'; requestId: number; envelope: SerializedAmplitudeEnvelope; defaultConfig: DetectionConfig }
  | { type: 'detectRegions'; requestId: number; regions: SilenceRegion[] }
  | { type: 'cutAudio'; requestId: number; channelData: Float32Array<ArrayBuffer>[]; sampleRate: number }
  | { type: 'error'; requestId: number; message: string };
