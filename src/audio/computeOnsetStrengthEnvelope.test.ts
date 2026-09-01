import { describe, expect, test } from 'vitest';
import { computeOnsetStrengthEnvelope } from './computeOnsetStrengthEnvelope';

describe('computeOnsetStrengthEnvelope', () => {
  test('is zero throughout a flat region, whether silent or steady noise', () => {
    expect(computeOnsetStrengthEnvelope(Float32Array.from([0.005, 0.005, 0.005, 0.005]))).toEqual(Float32Array.from([0, 0, 0, 0]));
  });

  test('spikes only on the rising edge of a burst, not its sustain or decay', () => {
    const envelope = Float32Array.from([0.01, 0.01, 0.5, 0.5, 0.5, 0.2, 0.01]);
    const onsetStrength = computeOnsetStrengthEnvelope(envelope);

    expect(onsetStrength[2]).toBeCloseTo(0.49); // the rise into the burst
    expect(onsetStrength[3]).toBe(0); // sustained, no further rise
    expect(onsetStrength[4]).toBe(0);
    expect(onsetStrength[5]).toBe(0); // decay is not a rise
    expect(onsetStrength[6]).toBe(0);
  });

  test('jittery-but-flat noise produces only its own small rises, not a false onset', () => {
    const envelope = Float32Array.from([0.005, 0.007, 0.004, 0.006]);
    const onsetStrength = computeOnsetStrengthEnvelope(envelope);

    expect(onsetStrength[1]).toBeCloseTo(0.002);
    expect(onsetStrength[2]).toBe(0); // a fall, clamped to zero
    expect(onsetStrength[3]).toBeCloseTo(0.002);
  });

  test('the first window always reads zero — there is no previous window for it to rise from', () => {
    const onsetStrength = computeOnsetStrengthEnvelope(Float32Array.from([0.9, 0.01]));
    expect(onsetStrength[0]).toBe(0);
  });

  test('handles a single-window envelope', () => {
    expect(computeOnsetStrengthEnvelope(Float32Array.from([0.9]))).toEqual(Float32Array.from([0]));
  });
});
