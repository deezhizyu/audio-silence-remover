import type { AmplitudeEnvelope } from './computeAmplitudeEnvelope';
import { runLengthEncodeSilence, silenceRunDurationSeconds, type SilenceRun } from './runLengthEncodeSilence';
import type { DetectionConfig, SilenceCategoryKey, SilenceRegion } from './types';

type MergeableSilenceRun = SilenceRun & { swallowedAudioRunCount: number };

/**
 * A stray click or breath sits only marginally above the silence threshold; real speech, even a single brief
 * word, drives RMS much closer to the file's peak reference. Gating swallowable runs to this multiple of the
 * threshold keeps quiet transients eligible while excluding audio that's actually loud enough to be speech.
 */
const STRAY_SOUND_AMPLITUDE_MULTIPLIER = 2;

/** Caps how many audio runs a single silence island can absorb, so a chain of brief words can't cascade into one deleted region. */
const MAX_SWALLOWED_AUDIO_RUNS_PER_ISLAND = 1;

function classifyDurationIntoCategory(durationSeconds: number, config: DetectionConfig): SilenceCategoryKey | null {
  if (durationSeconds >= config.long.minLengthSeconds) return 'long';
  if (durationSeconds >= config.medium.minLengthSeconds) return 'medium';
  if (durationSeconds >= config.short.minLengthSeconds) return 'short';
  return null;
}

function peakRootMeanSquareInRun(run: SilenceRun, envelope: AmplitudeEnvelope): number {
  let peak = 0;
  for (let windowIndex = run.startWindowIndex; windowIndex < run.endWindowIndex; windowIndex++) {
    const value = envelope.rootMeanSquarePerWindow[windowIndex];
    if (value > peak) peak = value;
  }
  return peak;
}

/**
 * Merges audio runs that are too brief and too quiet to count as "real" audio into their surrounding silence,
 * so a stray click or breath doesn't fragment an otherwise-continuous silence into many tiny unremoved pieces.
 * Each merge combines three runs (silence, brief audio, silence) into one, so the run count strictly decreases
 * and the loop always terminates. A run only qualifies if it's both brief (duration) and quiet (amplitude), and
 * each silence island may absorb at most one audio run, so a chain of short spoken words can't cascade into one
 * giant region that gets deleted wholesale.
 */
function mergeBriefAudioIntoSurroundingSilence(
  runs: SilenceRun[],
  envelope: AmplitudeEnvelope,
  amplitudeThreshold: number,
  config: DetectionConfig,
): SilenceRun[] {
  const windowSizeSeconds = envelope.windowSizeSeconds;
  const mergedRuns: MergeableSilenceRun[] = runs.map(run => ({ ...run, swallowedAudioRunCount: 0 }));
  const strayAmplitudeCeiling = Math.min(amplitudeThreshold * STRAY_SOUND_AMPLITUDE_MULTIPLIER, envelope.peakAmplitude);

  // A single forward pass with a local backtrack: merging a run can only create a new merge
  // opportunity immediately to its left (the run that's now adjacent to the freshly-merged
  // silence), never further away, so re-scanning the whole array from scratch after every merge
  // (as a naive fixed-point loop would) is unnecessary and quadratic. Backing up by one index
  // after each merge still explores every cascade a full restart would, just without redoing
  // already-settled work — same result, near-linear instead of O(n^2).
  let index = 1;
  while (index < mergedRuns.length - 1) {
    const audioRun = mergedRuns[index];
    const precedingSilence = mergedRuns[index - 1];
    const followingSilence = mergedRuns[index + 1];
    if (audioRun.isSilent || !precedingSilence.isSilent || !followingSilence.isSilent) {
      index++;
      continue;
    }

    const swallowedAudioRunCount = precedingSilence.swallowedAudioRunCount + followingSilence.swallowedAudioRunCount + 1;
    if (swallowedAudioRunCount > MAX_SWALLOWED_AUDIO_RUNS_PER_ISLAND) {
      index++;
      continue;
    }

    const mergedDurationSeconds = silenceRunDurationSeconds(
      { isSilent: true, startWindowIndex: precedingSilence.startWindowIndex, endWindowIndex: followingSilence.endWindowIndex },
      windowSizeSeconds,
    );
    const provisionalCategory = classifyDurationIntoCategory(mergedDurationSeconds, config);
    if (provisionalCategory === null) {
      index++;
      continue;
    }

    const audioRunDurationSeconds = silenceRunDurationSeconds(audioRun, windowSizeSeconds);
    if (audioRunDurationSeconds >= config[provisionalCategory].audibleLengthSeconds) {
      index++;
      continue;
    }

    if (peakRootMeanSquareInRun(audioRun, envelope) >= strayAmplitudeCeiling) {
      index++;
      continue;
    }

    mergedRuns.splice(index - 1, 3, {
      isSilent: true,
      startWindowIndex: precedingSilence.startWindowIndex,
      endWindowIndex: followingSilence.endWindowIndex,
      swallowedAudioRunCount,
    });
    index = Math.max(1, index - 1);
  }

  return mergedRuns;
}

export function detectSilenceRegions(envelope: AmplitudeEnvelope, config: DetectionConfig): SilenceRegion[] {
  const amplitudeThreshold = (config.volumeThresholdPercent / 100) * envelope.peakAmplitude;
  const isSilentPerWindow = Array.from(envelope.rootMeanSquarePerWindow, value => value < amplitudeThreshold);

  const rawRuns = runLengthEncodeSilence(isSilentPerWindow);
  const stabilizedRuns = mergeBriefAudioIntoSurroundingSilence(rawRuns, envelope, amplitudeThreshold, config);

  const regions: SilenceRegion[] = [];
  for (const run of stabilizedRuns) {
    if (!run.isSilent) continue;

    const durationSeconds = silenceRunDurationSeconds(run, envelope.windowSizeSeconds);
    const category = classifyDurationIntoCategory(durationSeconds, config);
    if (category === null) continue;

    regions.push({
      category,
      startSeconds: run.startWindowIndex * envelope.windowSizeSeconds,
      endSeconds: run.endWindowIndex * envelope.windowSizeSeconds,
    });
  }

  return regions;
}
