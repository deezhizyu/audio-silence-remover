import { clampNumber } from './clampNumber';

export interface ZoomBoxCenterFraction {
  x: number;
  y: number;
}

export interface ZoomBoxPixelRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** The zoom box always keeps the frame's own aspect ratio, so a single fraction drives both its width
    and height — 80% of the frame is the most zoomed out it can get, 10% the most zoomed in. */
export const ZOOM_BOX_MIN_SIZE_FRACTION = 0.1;
export const ZOOM_BOX_MAX_SIZE_FRACTION = 0.8;

export function clampZoomBoxSizeFraction(sizeFraction: number): number {
  return clampNumber(sizeFraction, ZOOM_BOX_MIN_SIZE_FRACTION, ZOOM_BOX_MAX_SIZE_FRACTION);
}

/** Keeps the box fully inside the `[0, 1]` frame given its current size — clamping each axis
    independently, same as `computeZoomWindowSeconds` does for the waveform zoom window. */
export function clampZoomBoxCenterFraction(center: ZoomBoxCenterFraction, sizeFraction: number): ZoomBoxCenterFraction {
  const halfSize = sizeFraction / 2;
  return {
    x: clampNumber(center.x, halfSize, 1 - halfSize),
    y: clampNumber(center.y, halfSize, 1 - halfSize),
  };
}

/** Converts the box's fractional center/size into a pixel-space source rect for `drawImage`, against the
    video's native (not rendered/CSS) dimensions. */
export function computeZoomBoxPixelRect(
  center: ZoomBoxCenterFraction,
  sizeFraction: number,
  frameWidthPixels: number,
  frameHeightPixels: number,
): ZoomBoxPixelRect {
  const sw = sizeFraction * frameWidthPixels;
  const sh = sizeFraction * frameHeightPixels;
  return {
    sx: (center.x - sizeFraction / 2) * frameWidthPixels,
    sy: (center.y - sizeFraction / 2) * frameHeightPixels,
    sw,
    sh,
  };
}
