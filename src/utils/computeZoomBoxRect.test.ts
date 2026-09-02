import { describe, expect, test } from 'vitest';
import { clampZoomBoxCenterFraction, clampZoomBoxSizeFraction, computeZoomBoxPixelRect } from './computeZoomBoxRect';

describe('clampZoomBoxSizeFraction', () => {
  test('clamps below the minimum up to it', () => {
    expect(clampZoomBoxSizeFraction(0.02)).toBe(0.1);
  });

  test('clamps above the maximum down to it', () => {
    expect(clampZoomBoxSizeFraction(0.95)).toBe(0.8);
  });

  test('passes an in-range value through unchanged', () => {
    expect(clampZoomBoxSizeFraction(0.4)).toBe(0.4);
  });
});

describe('clampZoomBoxCenterFraction', () => {
  test('leaves a center already inside bounds untouched', () => {
    expect(clampZoomBoxCenterFraction({ x: 0.5, y: 0.5 }, 0.4)).toEqual({ x: 0.5, y: 0.5 });
  });

  test('pulls the center back so the box stays inside the frame near the top-left edge', () => {
    expect(clampZoomBoxCenterFraction({ x: 0, y: 0 }, 0.4)).toEqual({ x: 0.2, y: 0.2 });
  });

  test('pulls the center back near the bottom-right edge', () => {
    expect(clampZoomBoxCenterFraction({ x: 1, y: 1 }, 0.4)).toEqual({ x: 0.8, y: 0.8 });
  });
});

describe('computeZoomBoxPixelRect', () => {
  test('computes a centered source rect at native pixel dimensions', () => {
    expect(computeZoomBoxPixelRect({ x: 0.5, y: 0.5 }, 0.4, 1000, 500)).toEqual({ sx: 300, sy: 150, sw: 400, sh: 200 });
  });

  test('shifts the rect when the center is off to one side', () => {
    const rect = computeZoomBoxPixelRect({ x: 0.2, y: 0.8 }, 0.2, 1000, 500);
    expect(rect.sx).toBeCloseTo(100, 10);
    expect(rect.sy).toBeCloseTo(350, 10);
    expect(rect.sw).toBeCloseTo(200, 10);
    expect(rect.sh).toBeCloseTo(100, 10);
  });
});
