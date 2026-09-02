import { describe, expect, test } from 'vitest';
import { chooseAlignmentEnvelopeWindowSeconds } from './chooseAlignmentEnvelopeWindowSeconds';

describe('chooseAlignmentEnvelopeWindowSeconds', () => {
  test('clamps to the minimum window for a short clip', () => {
    expect(chooseAlignmentEnvelopeWindowSeconds(5)).toBe(0.001);
  });

  test('clamps to the minimum window for a zero-duration clip', () => {
    expect(chooseAlignmentEnvelopeWindowSeconds(0)).toBe(0.001);
  });

  test('scales up past the minimum for a long clip, capping the total sample count', () => {
    expect(chooseAlignmentEnvelopeWindowSeconds(400)).toBeCloseTo(0.002, 10);
  });

  test('keeps scaling for a very long clip', () => {
    expect(chooseAlignmentEnvelopeWindowSeconds(7200)).toBeCloseTo(0.036, 10);
  });
});
