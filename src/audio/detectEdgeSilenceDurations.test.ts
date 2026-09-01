import { describe, expect, test } from 'vitest';
import { detectEdgeSilenceDurations } from './detectEdgeSilenceDurations';
import { buildSyntheticEnvelope } from './testHelpers/buildSyntheticEnvelope';

const VOLUME_THRESHOLD_PERCENT = 20; // amplitudeThreshold = 0.2 (peakAmplitude is fixed at 1 in the synthetic envelope)

describe('detectEdgeSilenceDurations', () => {
  test('detects both leading and trailing silence around audible audio', () => {
    // silence(0.3s) - audio(0.4s, rms 0.9) - silence(0.5s)
    const envelope = buildSyntheticEnvelope([
      [0.05, 3],
      [0.9, 4],
      [0.05, 5],
    ]);

    const { leadingSilenceSeconds, trailingSilenceSeconds } = detectEdgeSilenceDurations(envelope, VOLUME_THRESHOLD_PERCENT);

    expect(leadingSilenceSeconds).toBeCloseTo(0.3);
    expect(trailingSilenceSeconds).toBeCloseTo(0.5);
  });

  test('reports zero leading silence when audio starts immediately', () => {
    const envelope = buildSyntheticEnvelope([
      [0.9, 4],
      [0.05, 3],
    ]);

    const { leadingSilenceSeconds, trailingSilenceSeconds } = detectEdgeSilenceDurations(envelope, VOLUME_THRESHOLD_PERCENT);

    expect(leadingSilenceSeconds).toBe(0);
    expect(trailingSilenceSeconds).toBeCloseTo(0.3);
  });

  test('reports the full duration as both leading and trailing silence for a fully silent envelope', () => {
    const envelope = buildSyntheticEnvelope([[0.05, 5]]);

    const { leadingSilenceSeconds, trailingSilenceSeconds } = detectEdgeSilenceDurations(envelope, VOLUME_THRESHOLD_PERCENT);

    expect(leadingSilenceSeconds).toBeCloseTo(0.5);
    expect(trailingSilenceSeconds).toBeCloseTo(0.5);
  });

  test('treats a window exactly at the threshold as audible, matching detectSilenceRegions', () => {
    // A window at exactly the threshold value is NOT silent (detectSilenceRegions uses `rms < threshold`).
    const envelope = buildSyntheticEnvelope([
      [0.05, 2],
      [0.2, 1],
      [0.05, 2],
    ]);

    const { leadingSilenceSeconds, trailingSilenceSeconds } = detectEdgeSilenceDurations(envelope, VOLUME_THRESHOLD_PERCENT);

    expect(leadingSilenceSeconds).toBeCloseTo(0.2);
    expect(trailingSilenceSeconds).toBeCloseTo(0.2);
  });

  test('handles a single-window envelope', () => {
    const audible = buildSyntheticEnvelope([[0.9, 1]]);
    expect(detectEdgeSilenceDurations(audible, VOLUME_THRESHOLD_PERCENT)).toEqual({
      leadingSilenceSeconds: 0,
      trailingSilenceSeconds: 0,
    });

    const silent = buildSyntheticEnvelope([[0.05, 1]]);
    expect(detectEdgeSilenceDurations(silent, VOLUME_THRESHOLD_PERCENT)).toEqual({
      leadingSilenceSeconds: 0.1,
      trailingSilenceSeconds: 0.1,
    });
  });
});
