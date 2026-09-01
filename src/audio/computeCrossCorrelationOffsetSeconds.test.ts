import { describe, expect, test } from 'vitest';
import type { AmplitudeEnvelope } from './computeAmplitudeEnvelope';
import { computeCrossCorrelationOffsetSeconds } from './computeCrossCorrelationOffsetSeconds';

const WINDOW_SIZE_SECONDS = 0.1;

/** A non-repeating "signature" shape so cross-correlation has a single, unambiguous peak — unlike a
    flat or periodic pattern, which would correlate equally well at multiple lags. */
const SIGNATURE_SHAPE = [0.1, 0.8, 0.3, 0.9, 0.2, 0.05, 0.7, 0.4, 0.95, 0.15, 0.6, 0.25];

function buildEnvelope(values: number[]): AmplitudeEnvelope {
  return {
    rootMeanSquarePerWindow: Float32Array.from(values),
    windowSizeSeconds: WINDOW_SIZE_SECONDS,
    peakAmplitude: 1,
    durationSeconds: values.length * WINDOW_SIZE_SECONDS,
  };
}

function prependQuietWindows(values: number[], quietValue: number, count: number): number[] {
  return [...Array.from({ length: count }, () => quietValue), ...values];
}

describe('computeCrossCorrelationOffsetSeconds', () => {
  test('finds zero offset when the two envelopes are already aligned', () => {
    const original = buildEnvelope(SIGNATURE_SHAPE);
    const voiceChanged = buildEnvelope(SIGNATURE_SHAPE);

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBeCloseTo(0, 1);
  });

  test('finds the true offset when the voice-changed audio has extra padding at the start', () => {
    const original = buildEnvelope(SIGNATURE_SHAPE);
    // 4 windows (0.4s) of low-but-nonzero padding prepended — not literal zero, since real
    // voice-changer padding is quiet, not silent.
    const voiceChanged = buildEnvelope(prependQuietWindows(SIGNATURE_SHAPE, 0.03, 4));

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBeCloseTo(0.4, 1);
  });

  test('does not mistake a merely-quiet (not silent) intro for content to trim, unlike a threshold heuristic', () => {
    // Mirrors the real bug: the voice-changed audio's intro is well above zero but still much quieter
    // than the rest of the clip, which fools a percent-of-peak threshold into reading it as silence.
    // Cross-correlation should still find that the content itself starts at offset zero.
    const original = buildEnvelope(SIGNATURE_SHAPE);
    const quietButAudibleIntro = SIGNATURE_SHAPE.map(value => value * 0.15 + 0.05);
    const voiceChanged = buildEnvelope([...quietButAudibleIntro, ...SIGNATURE_SHAPE]);

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBeCloseTo(1.2, 1);
  });

  test('finds a negative offset when the voice-changed audio is missing the original leading portion', () => {
    const original = buildEnvelope(prependQuietWindows(SIGNATURE_SHAPE, 0.03, 3));
    const voiceChanged = buildEnvelope(SIGNATURE_SHAPE);

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBeCloseTo(-0.3, 1);
  });

  test('returns zero when the voice-changed audio is silent throughout', () => {
    const original = buildEnvelope(SIGNATURE_SHAPE);
    const voiceChanged = buildEnvelope(SIGNATURE_SHAPE.map(() => 0));

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBe(0);
  });

  test('returns zero when the original audio is silent throughout', () => {
    const original = buildEnvelope(SIGNATURE_SHAPE.map(() => 0));
    const voiceChanged = buildEnvelope(SIGNATURE_SHAPE);

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBe(0);
  });

  test('prefers the true zero-lag match over a spurious far-away near-tie on beat-like content with irregular spacing', () => {
    // Six pulses at slightly irregular offsets/widths/heights (not a single clean period) — close
    // enough to periodic that a shifted copy of the pattern can score within a fraction of a percent
    // of the true alignment, the same aliasing risk autocorrelation has on periodic signals. Quieting
    // (not removing) the first pulse in the voice-changed copy, as a real voice-changer would, weakens
    // the true zero-lag peak just enough to expose it: without a bias toward the smaller offset, a
    // distant lag wins outright by that fraction of a percent (confirmed by temporarily disabling the
    // bias while writing this test — the far lag won without it).
    const pulses = [
      { startWindow: 0, widthWindows: 5, amplitude: 0.8 },
      { startWindow: 7, widthWindows: 3, amplitude: 0.5 },
      { startWindow: 13, widthWindows: 6, amplitude: 0.9 },
      { startWindow: 22, widthWindows: 2, amplitude: 0.4 },
      { startWindow: 27, widthWindows: 8, amplitude: 0.7 },
      { startWindow: 36, widthWindows: 3, amplitude: 0.6 },
    ];
    const buildPulseTrain = (firstPulseAmplitude: number) => {
      const values = new Array(400).fill(0);
      for (const [pulseIndex, pulse] of pulses.entries()) {
        const amplitude = pulseIndex === 0 ? firstPulseAmplitude : pulse.amplitude;
        for (let window = pulse.startWindow; window < pulse.startWindow + pulse.widthWindows; window++) values[window] = amplitude;
      }
      return values;
    };

    const original = buildEnvelope(buildPulseTrain(0.8));
    const voiceChanged = buildEnvelope(buildPulseTrain(0.04));

    expect(computeCrossCorrelationOffsetSeconds(original, voiceChanged)).toBeCloseTo(0, 1);
  });

  test('respects a narrower search range, ignoring a better match outside it', () => {
    const original = buildEnvelope(SIGNATURE_SHAPE);
    const voiceChanged = buildEnvelope(prependQuietWindows(SIGNATURE_SHAPE, 0.03, 4));

    const offset = computeCrossCorrelationOffsetSeconds(original, voiceChanged, { minOffsetSeconds: 0, maxOffsetSeconds: 0.2 });

    expect(offset).not.toBeCloseTo(0.4, 1);
  });
});
