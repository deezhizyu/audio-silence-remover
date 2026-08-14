import type { AmplitudeEnvelope } from './computeAmplitudeEnvelope';
import { clampNumber } from '../utils/clampNumber';
import { runLengthEncodeSilence, silenceRunDurationSeconds } from './runLengthEncodeSilence';
import type { DetectionConfig } from './types';

const MINIMUM_SHORT_LENGTH_SECONDS = 0.2;
const VOLUME_THRESHOLD_PERCENTILE = 0.2;
const SHORT_MEDIUM_BOUNDARY_PERCENTILE = 0.33;
const MEDIUM_LONG_BOUNDARY_PERCENTILE = 0.66;
const MINIMUM_VOLUME_THRESHOLD_PERCENT = 1;
const MAXIMUM_VOLUME_THRESHOLD_PERCENT = 50;
const DEFAULT_AUDIBLE_LENGTH_SECONDS = 0.2;
/** Auto-detected "replaced with" length is half of the category's own auto-detected minimum length. */
const REPLACED_LENGTH_MIN_LENGTH_RATIO = 0.5;

function valueAtPercentile(sortedAscendingValues: Float32Array<ArrayBuffer> | number[], fraction: number): number {
  if (sortedAscendingValues.length === 0) return 0;
  const index = clampNumber(Math.floor(fraction * sortedAscendingValues.length), 0, sortedAscendingValues.length - 1);
  return sortedAscendingValues[index];
}

/**
 * Analyzes the actual uploaded file — its loudness distribution and the gap durations produced by that
 * loudness distribution — to propose starting values, rather than shipping one fixed preset for every file.
 */
export function computeDefaultDetectionConfig(envelope: AmplitudeEnvelope): DetectionConfig {
  const sortedRmsValues = Float32Array.from(envelope.rootMeanSquarePerWindow).sort();
  const candidateThresholdAmplitude = valueAtPercentile(sortedRmsValues, VOLUME_THRESHOLD_PERCENTILE);
  const volumeThresholdPercent = clampNumber(
    Math.round((candidateThresholdAmplitude / envelope.peakAmplitude) * 100),
    MINIMUM_VOLUME_THRESHOLD_PERCENT,
    MAXIMUM_VOLUME_THRESHOLD_PERCENT,
  );

  const amplitudeThreshold = (volumeThresholdPercent / 100) * envelope.peakAmplitude;
  const isSilentPerWindow = Array.from(envelope.rootMeanSquarePerWindow, value => value < amplitudeThreshold);
  const runs = runLengthEncodeSilence(isSilentPerWindow);

  const silenceGapDurationsSeconds = runs
    .filter(run => run.isSilent)
    .map(run => silenceRunDurationSeconds(run, envelope.windowSizeSeconds))
    .filter(duration => duration >= MINIMUM_SHORT_LENGTH_SECONDS)
    .sort((a, b) => a - b);

  const shortMinLengthSeconds = MINIMUM_SHORT_LENGTH_SECONDS;
  const mediumMinLengthSeconds = Math.max(
    shortMinLengthSeconds,
    valueAtPercentile(silenceGapDurationsSeconds, SHORT_MEDIUM_BOUNDARY_PERCENTILE) || shortMinLengthSeconds,
  );
  const longMinLengthSeconds = Math.max(
    mediumMinLengthSeconds,
    valueAtPercentile(silenceGapDurationsSeconds, MEDIUM_LONG_BOUNDARY_PERCENTILE) || mediumMinLengthSeconds,
  );

  return {
    volumeThresholdPercent,
    short: {
      minLengthSeconds: shortMinLengthSeconds,
      replacedLengthSeconds: shortMinLengthSeconds * REPLACED_LENGTH_MIN_LENGTH_RATIO,
      audibleLengthSeconds: DEFAULT_AUDIBLE_LENGTH_SECONDS,
    },
    medium: {
      minLengthSeconds: mediumMinLengthSeconds,
      replacedLengthSeconds: mediumMinLengthSeconds * REPLACED_LENGTH_MIN_LENGTH_RATIO,
      audibleLengthSeconds: DEFAULT_AUDIBLE_LENGTH_SECONDS,
    },
    long: {
      minLengthSeconds: longMinLengthSeconds,
      replacedLengthSeconds: longMinLengthSeconds * REPLACED_LENGTH_MIN_LENGTH_RATIO,
      audibleLengthSeconds: DEFAULT_AUDIBLE_LENGTH_SECONDS,
    },
  };
}
