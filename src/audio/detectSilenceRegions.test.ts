import { describe, expect, test } from 'vitest';
import { detectSilenceRegions } from './detectSilenceRegions';
import { buildSyntheticEnvelope as buildEnvelope } from './testHelpers/buildSyntheticEnvelope';
import type { DetectionConfig, SilenceRegion } from './types';

/** Rounds region boundaries to avoid asserting on floating-point accumulation noise from repeated window-size addition. */
function roundRegions(regions: SilenceRegion[]): SilenceRegion[] {
  return regions.map(region => ({
    ...region,
    startSeconds: Math.round(region.startSeconds * 1e6) / 1e6,
    endSeconds: Math.round(region.endSeconds * 1e6) / 1e6,
  }));
}

function buildConfig(): DetectionConfig {
  return {
    volumeThresholdPercent: 20, // amplitudeThreshold = 0.2
    short: { minLengthSeconds: 0.2, replacedLengthSeconds: 0.1, audibleLengthSeconds: 0.3 },
    medium: { minLengthSeconds: 0.5, replacedLengthSeconds: 0.2, audibleLengthSeconds: 0.3 },
    long: { minLengthSeconds: 1.0, replacedLengthSeconds: 0.4, audibleLengthSeconds: 0.3 },
  };
}

describe('detectSilenceRegions', () => {
  test('swallows a genuine stray breath between two silences', () => {
    // silence(0.5s) - quiet breath(0.2s, rms 0.25, just above the 0.2 threshold) - silence(0.5s)
    const envelope = buildEnvelope([
      [0.05, 5],
      [0.25, 2],
      [0.05, 5],
    ]);

    const regions = detectSilenceRegions(envelope, buildConfig());

    expect(roundRegions(regions)).toEqual([{ category: 'long', startSeconds: 0, endSeconds: 1.2 }]);
  });

  test('does not swallow a short but loud word between two silences', () => {
    // silence(0.5s) - loud word(0.2s, rms 0.9) - silence(0.5s)
    const envelope = buildEnvelope([
      [0.05, 5],
      [0.9, 2],
      [0.05, 5],
    ]);

    const regions = detectSilenceRegions(envelope, buildConfig());

    // The word is preserved: the two silences stay separate rather than merging into one deleted region.
    expect(roundRegions(regions)).toEqual([
      { category: 'medium', startSeconds: 0, endSeconds: 0.5 },
      { category: 'medium', startSeconds: 0.7, endSeconds: 1.2 },
    ]);
  });

  test('does not collapse a chain of short loud words into one region', () => {
    const chained = buildEnvelope([
      [0.05, 3], // silence 0.3s
      [0.9, 2], // word 0.2s
      [0.05, 3], // silence 0.3s
      [0.9, 2], // word 0.2s
      [0.05, 3], // silence 0.3s
      [0.9, 2], // word 0.2s
      [0.05, 3], // silence 0.3s
    ]);

    const regions = detectSilenceRegions(chained, buildConfig());

    expect(roundRegions(regions)).toEqual([
      { category: 'short', startSeconds: 0, endSeconds: 0.3 },
      { category: 'short', startSeconds: 0.5, endSeconds: 0.8 },
      { category: 'short', startSeconds: 1.0, endSeconds: 1.3 },
      { category: 'short', startSeconds: 1.5, endSeconds: 1.8 },
    ]);
  });

  test('caps cascading merges to one swallowed audio run per silence island', () => {
    // silence(0.4s) - breath1(0.1s, quiet) - silence(0.4s) - breath2(0.1s, quiet) - silence(0.4s)
    const envelope = buildEnvelope([
      [0.05, 4],
      [0.25, 1],
      [0.05, 4],
      [0.25, 1],
      [0.05, 4],
    ]);

    const regions = detectSilenceRegions(envelope, buildConfig());

    // Only the first breath is swallowed into its surrounding silence; the second breath blocks further
    // cascading, so it survives as its own (unclassified, non-silent) gap between two separate regions.
    expect(roundRegions(regions)).toEqual([
      { category: 'medium', startSeconds: 0, endSeconds: 0.9 },
      { category: 'short', startSeconds: 1.0, endSeconds: 1.4 },
    ]);
  });
});
