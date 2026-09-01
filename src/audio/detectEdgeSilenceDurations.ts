import type { AmplitudeEnvelope } from './computeAmplitudeEnvelope';
import { computeAmplitudeThreshold } from './computeAmplitudeThreshold';

export interface EdgeSilenceDurations {
  leadingSilenceSeconds: number;
  trailingSilenceSeconds: number;
}

/**
 * Scans from each end of the envelope independently for the first window at/above the threshold.
 * A fully silent envelope reports both durations as the full clip duration — each is a standalone
 * scan, not mutually exclusive halves, so callers that need to guard against double-counting an
 * entirely silent clip must do so themselves.
 */
export function detectEdgeSilenceDurations(envelope: AmplitudeEnvelope, volumeThresholdPercent: number): EdgeSilenceDurations {
  const amplitudeThreshold = computeAmplitudeThreshold(envelope, volumeThresholdPercent);
  const windows = envelope.rootMeanSquarePerWindow;
  const windowCount = windows.length;

  let firstAudibleWindowIndex = windowCount;
  for (let index = 0; index < windowCount; index++) {
    if (windows[index] >= amplitudeThreshold) {
      firstAudibleWindowIndex = index;
      break;
    }
  }

  let lastAudibleWindowIndex = -1;
  for (let index = windowCount - 1; index >= 0; index--) {
    if (windows[index] >= amplitudeThreshold) {
      lastAudibleWindowIndex = index;
      break;
    }
  }

  return {
    leadingSilenceSeconds: firstAudibleWindowIndex * envelope.windowSizeSeconds,
    trailingSilenceSeconds: (windowCount - 1 - lastAudibleWindowIndex) * envelope.windowSizeSeconds,
  };
}
