import { describe, expect, test } from 'vitest';
import { computeZoomWindowSeconds } from './computeZoomWindowSeconds';

describe('computeZoomWindowSeconds', () => {
  test('centers a fixed-width window on the given point, away from the domain edges', () => {
    const window = computeZoomWindowSeconds(10, 4, 100);
    expect(window).toEqual({ startSeconds: 8, endSeconds: 12 });
  });

  test('slides (does not shrink) the window when the center is near the start', () => {
    const window = computeZoomWindowSeconds(1, 4, 100);
    expect(window).toEqual({ startSeconds: 0, endSeconds: 4 });
  });

  test('slides (does not shrink) the window when the center is near the end', () => {
    const window = computeZoomWindowSeconds(99, 4, 100);
    expect(window).toEqual({ startSeconds: 96, endSeconds: 100 });
  });

  test('centered exactly at the very start clamps to the domain start', () => {
    const window = computeZoomWindowSeconds(0, 4, 100);
    expect(window).toEqual({ startSeconds: 0, endSeconds: 4 });
  });

  test('centered exactly at the very end clamps to the domain end', () => {
    const window = computeZoomWindowSeconds(100, 4, 100);
    expect(window).toEqual({ startSeconds: 96, endSeconds: 100 });
  });

  test('shrinks the window to the full domain when the domain is narrower than the requested width', () => {
    const window = computeZoomWindowSeconds(1, 10, 3);
    expect(window).toEqual({ startSeconds: 0, endSeconds: 3 });
  });

  test('handles a zero-duration domain without producing NaN', () => {
    const window = computeZoomWindowSeconds(0, 4, 0);
    expect(window).toEqual({ startSeconds: 0, endSeconds: 0 });
  });
});
