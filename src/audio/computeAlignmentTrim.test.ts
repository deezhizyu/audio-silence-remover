import { describe, expect, test } from 'vitest';
import { computeAlignmentTrim } from './computeAlignmentTrim';

describe('computeAlignmentTrim', () => {
  test('trims the extra leading padding and the excess tail when the voice-changed audio runs long', () => {
    const trim = computeAlignmentTrim({
      originalLeadingSilenceSeconds: 0.2,
      originalAudioDurationSeconds: 10,
      voiceChangedLeadingSilenceSeconds: 0.9,
      voiceChangedDurationSeconds: 11,
    });

    expect(trim.startTrimSeconds).toBeCloseTo(0.7);
    // remaining after start trim: 11 - 0.7 = 10.3, which is 0.3s longer than the 10s original
    expect(trim.endTrimSeconds).toBeCloseTo(0.3);
  });

  test('does not trim the start when the voice-changed audio already has less leading silence than the original', () => {
    const trim = computeAlignmentTrim({
      originalLeadingSilenceSeconds: 0.9,
      originalAudioDurationSeconds: 10,
      voiceChangedLeadingSilenceSeconds: 0.2,
      voiceChangedDurationSeconds: 9.5,
    });

    expect(trim.startTrimSeconds).toBe(0);
  });

  test('does not trim the end when the voice-changed audio ends up shorter than the original after the start trim', () => {
    const trim = computeAlignmentTrim({
      originalLeadingSilenceSeconds: 0.1,
      originalAudioDurationSeconds: 10,
      voiceChangedLeadingSilenceSeconds: 0.6,
      voiceChangedDurationSeconds: 9,
    });

    expect(trim.startTrimSeconds).toBeCloseTo(0.5);
    expect(trim.endTrimSeconds).toBe(0);
  });

  test('trims nothing when both sources already match', () => {
    const trim = computeAlignmentTrim({
      originalLeadingSilenceSeconds: 0.4,
      originalAudioDurationSeconds: 10,
      voiceChangedLeadingSilenceSeconds: 0.4,
      voiceChangedDurationSeconds: 10,
    });

    expect(trim).toEqual({ startTrimSeconds: 0, endTrimSeconds: 0 });
  });

  test('cuts all of the padding when the original has no leading silence at all', () => {
    const trim = computeAlignmentTrim({
      originalLeadingSilenceSeconds: 0,
      originalAudioDurationSeconds: 10,
      voiceChangedLeadingSilenceSeconds: 1.2,
      voiceChangedDurationSeconds: 11,
    });

    expect(trim.startTrimSeconds).toBeCloseTo(1.2);
    expect(trim.endTrimSeconds).toBeCloseTo(0);
  });
});
