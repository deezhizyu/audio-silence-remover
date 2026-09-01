import type { AmplitudeEnvelope } from './computeAmplitudeEnvelope';

export function computeAmplitudeThreshold(envelope: AmplitudeEnvelope, volumeThresholdPercent: number): number {
  return (volumeThresholdPercent / 100) * envelope.peakAmplitude;
}
