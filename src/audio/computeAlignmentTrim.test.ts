import { describe, expect, test } from 'vitest';
import { computeAlignmentTrim } from './computeAlignmentTrim';

describe('computeAlignmentTrim', () => {
  test('trims the given start offset and the excess tail when the voice-changed audio runs long', () => {
    const trim = computeAlignmentTrim({
      startTrimSeconds: 0.7,
      originalAudioDurationSeconds: 10,
      voiceChangedDurationSeconds: 11,
    });

    expect(trim.startTrimSeconds).toBeCloseTo(0.7);
    // remaining after start trim: 11 - 0.7 = 10.3, which is 0.3s longer than the 10s original
    expect(trim.endTrimSeconds).toBeCloseTo(0.3);
  });

  test('clamps a negative start offset to zero rather than padding', () => {
    const trim = computeAlignmentTrim({
      startTrimSeconds: -0.5,
      originalAudioDurationSeconds: 10,
      voiceChangedDurationSeconds: 9.5,
    });

    expect(trim.startTrimSeconds).toBe(0);
  });

  test('does not trim the end when the voice-changed audio ends up shorter than the original after the start trim', () => {
    const trim = computeAlignmentTrim({
      startTrimSeconds: 0.5,
      originalAudioDurationSeconds: 10,
      voiceChangedDurationSeconds: 9,
    });

    expect(trim.startTrimSeconds).toBeCloseTo(0.5);
    expect(trim.endTrimSeconds).toBe(0);
  });

  test('trims nothing when both sources already match', () => {
    const trim = computeAlignmentTrim({
      startTrimSeconds: 0,
      originalAudioDurationSeconds: 10,
      voiceChangedDurationSeconds: 10,
    });

    expect(trim).toEqual({ startTrimSeconds: 0, endTrimSeconds: 0 });
  });

  test('trims all of the given offset when it consumes exactly the excess duration', () => {
    const trim = computeAlignmentTrim({
      startTrimSeconds: 1.2,
      originalAudioDurationSeconds: 10,
      voiceChangedDurationSeconds: 11.2,
    });

    expect(trim.startTrimSeconds).toBeCloseTo(1.2);
    expect(trim.endTrimSeconds).toBeCloseTo(0);
  });
});
