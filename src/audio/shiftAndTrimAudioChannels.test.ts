import { describe, expect, test } from 'vitest';
import { shiftAndTrimAudioChannels } from './shiftAndTrimAudioChannels';

const SAMPLE_RATE = 10; // 10 frames = 1 second, for easy-to-read test data

describe('shiftAndTrimAudioChannels', () => {
  test('slices every channel by the given start/end trim in seconds when the shift is positive', () => {
    const left = Float32Array.from({ length: 10 }, (_, index) => index);
    const right = Float32Array.from({ length: 10 }, (_, index) => -index);

    const [trimmedLeft, trimmedRight] = shiftAndTrimAudioChannels([left, right], SAMPLE_RATE, 0.2, 0.3);

    expect(Array.from(trimmedLeft)).toEqual([2, 3, 4, 5, 6]);
    expect(Array.from(trimmedRight)).toEqual([-2, -3, -4, -5, -6]);
  });

  test('does not mutate the input channels', () => {
    const original = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const originalCopy = Float32Array.from(original);

    shiftAndTrimAudioChannels([original], SAMPLE_RATE, 0.2, 0.2);

    expect(original).toEqual(originalCopy);
  });

  test('rounds non-integer frame boundaries to the nearest sample', () => {
    const channel = Float32Array.from({ length: 10 }, (_, index) => index);

    // 0.24s * 10Hz = 2.4 -> rounds to frame 2
    const [trimmed] = shiftAndTrimAudioChannels([channel], SAMPLE_RATE, 0.24, 0);

    expect(Array.from(trimmed)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('clamps trims that would overlap to an empty result instead of throwing', () => {
    const channel = Float32Array.from({ length: 10 }, (_, index) => index);

    const [trimmed] = shiftAndTrimAudioChannels([channel], SAMPLE_RATE, 0.8, 0.8);

    expect(trimmed.length).toBe(0);
  });

  test('prepends zero-fill silence instead of trimming when the shift is negative', () => {
    const channel = Float32Array.from({ length: 10 }, (_, index) => index + 1);

    const [shifted] = shiftAndTrimAudioChannels([channel], SAMPLE_RATE, -0.3, 0);

    expect(Array.from(shifted)).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('combines a negative shift with an end trim', () => {
    const channel = Float32Array.from({ length: 10 }, (_, index) => index + 1);

    const [shifted] = shiftAndTrimAudioChannels([channel], SAMPLE_RATE, -0.2, 0.3);

    // 2 frames of silence prepended, then the original minus its last 3 frames
    expect(Array.from(shifted)).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test('does not mutate the input channels when padding', () => {
    const original = Float32Array.from([1, 2, 3, 4, 5]);
    const originalCopy = Float32Array.from(original);

    shiftAndTrimAudioChannels([original], SAMPLE_RATE, -0.2, 0);

    expect(original).toEqual(originalCopy);
  });

  test('a zero shift with a zero trim returns the full audio unchanged', () => {
    const channel = Float32Array.from([1, 2, 3, 4, 5]);

    const [result] = shiftAndTrimAudioChannels([channel], SAMPLE_RATE, 0, 0);

    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
  });
});
