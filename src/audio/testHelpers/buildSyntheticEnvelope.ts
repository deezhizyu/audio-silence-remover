import type { AmplitudeEnvelope } from '../computeAmplitudeEnvelope';

const WINDOW_SIZE_SECONDS = 0.1;
const PEAK_AMPLITUDE = 1;

/** Builds a synthetic envelope from segments of (rms value, window count), each window WINDOW_SIZE_SECONDS long. */
export function buildSyntheticEnvelope(segments: Array<[rms: number, windowCount: number]>): AmplitudeEnvelope {
  const values = segments.flatMap(([rms, windowCount]) => Array.from({ length: windowCount }, () => rms));
  return {
    rootMeanSquarePerWindow: Float32Array.from(values),
    windowSizeSeconds: WINDOW_SIZE_SECONDS,
    peakAmplitude: PEAK_AMPLITUDE,
    durationSeconds: values.length * WINDOW_SIZE_SECONDS,
  };
}
