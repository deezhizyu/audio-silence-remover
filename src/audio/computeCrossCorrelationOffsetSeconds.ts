import { clampNumber } from '../utils/clampNumber';
import type { AmplitudeEnvelope } from './computeAmplitudeEnvelope';
import { computeOnsetStrengthEnvelope } from './computeOnsetStrengthEnvelope';

export interface CrossCorrelationSearchRangeSeconds {
  minOffsetSeconds: number;
  maxOffsetSeconds: number;
}

/** Voice-changer intro padding is realistically a few seconds at most; this bounds the search well
    above that while keeping the scan cheap even for long clips. */
const DEFAULT_MAX_SEARCH_OFFSET_SECONDS = 20;

/** A candidate lag is only scored if the two envelopes overlap by at least this fraction of the
    shorter one — otherwise a tiny sliver of coincidental agreement near the search boundary could
    outscore the real, full-length match. */
const MINIMUM_OVERLAP_FRACTION = 0.3;

/** A slight bias toward the smallest offset, subtracted per second of |lag| before picking the best
    score. Repetitive or beat-like audio can have a shifted copy of itself line up almost as well as
    the true alignment (the same failure mode autocorrelation has on periodic signals), so without
    this a near-tie in raw score can hand the win to a spurious, far-away lag. Real voice-changer
    padding is realistically a few seconds at most, so this is deliberately weak: a lag with a
    genuinely, clearly better match (the common case — see computeCrossCorrelationOffsetSeconds.test.ts)
    still wins outright regardless of distance from zero. */
const ZERO_OFFSET_BIAS_PER_SECOND = 0.01;

const DEFAULT_SEARCH_RANGE_SECONDS: CrossCorrelationSearchRangeSeconds = {
  minOffsetSeconds: -DEFAULT_MAX_SEARCH_OFFSET_SECONDS,
  maxOffsetSeconds: DEFAULT_MAX_SEARCH_OFFSET_SECONDS,
};

/**
 * Finds how far into the voice-changed audio its content actually starts matching the original, by
 * cross-correlating each envelope's onset strength (see computeOnsetStrengthEnvelope) — the rising
 * edges of loud waveform beginnings and individual transients — rather than the raw RMS amplitude or
 * where either file happens to cross a volume threshold. Two problems with those alternatives, both
 * seen on real recordings: a voice changer's output is rarely at the same loudness as its source, so
 * "where does each file stop reading as quiet" and "where does the same sound actually begin" are
 * different questions, and a threshold-based comparison answers only the first, silently
 * misattributing any gap between them as content to trim. And a steady background noise floor in the
 * original recording (room tone, mic hiss) — which a voice changer typically strips out entirely, and
 * which persists under the speech too, not just before it — dilutes a raw-amplitude correlation across
 * the whole clip. Onset strength is near zero for both silence and steady noise, so it naturally
 * ignores both and locks onto the same transients a listener would use to sync the two by ear.
 *
 * The returned offset can be negative (the voice-changed audio's matching content starts before the
 * original's) — callers that only ever trim, never pad, must clamp it to zero themselves.
 */
export function computeCrossCorrelationOffsetSeconds(
  originalEnvelope: AmplitudeEnvelope,
  voiceChangedEnvelope: AmplitudeEnvelope,
  searchRangeSeconds: CrossCorrelationSearchRangeSeconds = DEFAULT_SEARCH_RANGE_SECONDS,
): number {
  // Both envelopes are built with the same fixed window duration (see computeAmplitudeEnvelope.ts)
  // regardless of each file's native sample rate, so their window grids already line up in time —
  // the original's window size is used as the shared clock.
  const windowSizeSeconds = originalEnvelope.windowSizeSeconds;
  const original = normalizeToZScore(computeOnsetStrengthEnvelope(originalEnvelope.rootMeanSquarePerWindow));
  const voiceChanged = normalizeToZScore(computeOnsetStrengthEnvelope(voiceChangedEnvelope.rootMeanSquarePerWindow));
  if (!original || !voiceChanged) return 0; // one side has no onsets at all; no meaningful offset to find

  const minLagWindows = Math.round(searchRangeSeconds.minOffsetSeconds / windowSizeSeconds);
  const maxLagWindows = Math.round(searchRangeSeconds.maxOffsetSeconds / windowSizeSeconds);
  const minimumOverlapWindows = Math.max(1, Math.floor(MINIMUM_OVERLAP_FRACTION * Math.min(original.length, voiceChanged.length)));

  const scoresByLagWindows = new Map<number, number>();
  for (let lagWindows = minLagWindows; lagWindows <= maxLagWindows; lagWindows++) {
    const rawScore = correlationScoreAtLag(original, voiceChanged, lagWindows, minimumOverlapWindows);
    if (rawScore === null) continue;
    const regularizedScore = rawScore - ZERO_OFFSET_BIAS_PER_SECOND * Math.abs(lagWindows * windowSizeSeconds);
    scoresByLagWindows.set(lagWindows, regularizedScore);
  }
  if (scoresByLagWindows.size === 0) return 0; // no lag in range had enough overlap to score

  let bestLagWindows = 0;
  let bestScore = -Infinity;
  for (const [lagWindows, score] of scoresByLagWindows) {
    if (score > bestScore) {
      bestScore = score;
      bestLagWindows = lagWindows;
    }
  }

  const scoreBeforeBest = scoresByLagWindows.get(bestLagWindows - 1) ?? bestScore;
  const scoreAfterBest = scoresByLagWindows.get(bestLagWindows + 1) ?? bestScore;
  const subWindowOffset = parabolicInterpolationOffset(scoreBeforeBest, bestScore, scoreAfterBest);

  return (bestLagWindows + subWindowOffset) * windowSizeSeconds;
}

function normalizeToZScore(values: Float32Array): Float32Array | null {
  const count = values.length;
  if (count === 0) return null;

  let mean = 0;
  for (let index = 0; index < count; index++) mean += values[index];
  mean /= count;

  let sumOfSquaredDeviations = 0;
  for (let index = 0; index < count; index++) {
    const deviation = values[index] - mean;
    sumOfSquaredDeviations += deviation * deviation;
  }
  const standardDeviation = Math.sqrt(sumOfSquaredDeviations / count);
  if (standardDeviation === 0) return null; // perfectly flat (e.g. fully silent) — no shape to correlate against

  const normalized = new Float32Array(count);
  for (let index = 0; index < count; index++) normalized[index] = (values[index] - mean) / standardDeviation;
  return normalized;
}

/** `lagWindows` is how many windows later the voice-changed audio's matching content starts, relative
    to the original — i.e. how much would need to be trimmed from the voice-changed audio's start to
    align it. Positive lag compares `original[i]` against `voiceChanged[i + lag]`; negative lag compares
    `original[i - lag]` against `voiceChanged[i]`. */
function correlationScoreAtLag(original: Float32Array, voiceChanged: Float32Array, lagWindows: number, minimumOverlapWindows: number): number | null {
  const originalStart = Math.max(0, -lagWindows);
  const voiceChangedStart = Math.max(0, lagWindows);
  const overlapLength = Math.min(original.length - originalStart, voiceChanged.length - voiceChangedStart);
  if (overlapLength < minimumOverlapWindows) return null;

  let dotProduct = 0;
  for (let index = 0; index < overlapLength; index++) {
    dotProduct += original[originalStart + index] * voiceChanged[voiceChangedStart + index];
  }
  return dotProduct / overlapLength;
}

/** Fits a parabola through the best-scoring lag and its two neighbors to recover sub-window precision —
    real audio content doesn't land exactly on this envelope's window grid, so this reclaims most of the
    precision the grid resolution would otherwise discard. */
function parabolicInterpolationOffset(scoreBefore: number, scoreAtPeak: number, scoreAfter: number): number {
  const curvature = scoreBefore - 2 * scoreAtPeak + scoreAfter;
  if (curvature === 0) return 0;
  return clampNumber((0.5 * (scoreBefore - scoreAfter)) / curvature, -0.5, 0.5);
}
