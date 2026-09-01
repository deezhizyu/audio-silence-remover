import { describe, expect, test } from 'vitest';
import { computeAmplitudeThreshold } from './computeAmplitudeThreshold';
import { buildSyntheticEnvelope } from './testHelpers/buildSyntheticEnvelope';

describe('computeAmplitudeThreshold', () => {
  test('scales the envelope peak amplitude by the given percent', () => {
    const envelope = buildSyntheticEnvelope([[0.5, 3]]);

    expect(computeAmplitudeThreshold(envelope, 20)).toBeCloseTo(0.2);
    expect(computeAmplitudeThreshold(envelope, 50)).toBeCloseTo(0.5);
    expect(computeAmplitudeThreshold(envelope, 100)).toBeCloseTo(1);
  });

  test('returns zero for a zero percent threshold', () => {
    const envelope = buildSyntheticEnvelope([[0.5, 3]]);

    expect(computeAmplitudeThreshold(envelope, 0)).toBe(0);
  });
});
