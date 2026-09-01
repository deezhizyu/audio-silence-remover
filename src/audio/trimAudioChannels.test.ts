import { describe, expect, test } from 'vitest';
import { trimAudioChannels } from './trimAudioChannels';

const SAMPLE_RATE = 10; // 10 frames = 1 second, for easy-to-read test data

describe('trimAudioChannels', () => {
  test('slices every channel by the given start/end trim in seconds', () => {
    const left = Float32Array.from({ length: 10 }, (_, index) => index);
    const right = Float32Array.from({ length: 10 }, (_, index) => -index);

    const [trimmedLeft, trimmedRight] = trimAudioChannels([left, right], SAMPLE_RATE, 0.2, 0.3);

    expect(Array.from(trimmedLeft)).toEqual([2, 3, 4, 5, 6]);
    expect(Array.from(trimmedRight)).toEqual([-2, -3, -4, -5, -6]);
  });

  test('does not mutate the input channels', () => {
    const original = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const originalCopy = Float32Array.from(original);

    trimAudioChannels([original], SAMPLE_RATE, 0.2, 0.2);

    expect(original).toEqual(originalCopy);
  });

  test('rounds non-integer frame boundaries to the nearest sample', () => {
    const channel = Float32Array.from({ length: 10 }, (_, index) => index);

    // 0.24s * 10Hz = 2.4 -> rounds to frame 2
    const [trimmed] = trimAudioChannels([channel], SAMPLE_RATE, 0.24, 0);

    expect(Array.from(trimmed)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('clamps trims that would overlap to an empty result instead of throwing', () => {
    const channel = Float32Array.from({ length: 10 }, (_, index) => index);

    const [trimmed] = trimAudioChannels([channel], SAMPLE_RATE, 0.8, 0.8);

    expect(trimmed.length).toBe(0);
  });
});
