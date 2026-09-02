import { describe, expect, test } from 'vitest';
import { applyEdgeFades } from './applyEdgeFades';

const SAMPLE_RATE = 100; // 100 frames = 1 second

describe('applyEdgeFades', () => {
  test('ramps the first sample to silence and leaves samples past the fade window untouched', () => {
    const channel = Float32Array.from({ length: 100 }, () => 1);

    const [faded] = applyEdgeFades([channel], SAMPLE_RATE, 0.1);

    expect(faded[0]).toBe(0);
    expect(faded[99]).toBe(0);
    // Just past the 10-frame fade window (frames 10..89) is untouched, full amplitude.
    expect(faded[10]).toBe(1);
    expect(faded[89]).toBe(1);
    // Partway through the fade-in ramp.
    expect(faded[5]).toBeCloseTo(0.5);
  });

  test('does not mutate the input channels', () => {
    const original = Float32Array.from({ length: 100 }, () => 1);
    const originalCopy = Float32Array.from(original);

    applyEdgeFades([original], SAMPLE_RATE, 0.1);

    expect(original).toEqual(originalCopy);
  });

  test('clamps the fade window so it never overlaps itself on a very short clip', () => {
    const channel = Float32Array.from({ length: 6 }, () => 1);

    // Requested fade (0.1s * 100Hz = 10 frames) is clamped to floor(6 / 2) = 3 frames per side.
    const [faded] = applyEdgeFades([channel], SAMPLE_RATE, 0.1);

    expect(faded[0]).toBe(0);
    expect(faded[5]).toBe(0);
    expect(Array.from(faded).every(value => value >= 0 && value <= 1)).toBe(true);
  });
});
