export interface ZoomWindowSeconds {
  startSeconds: number;
  endSeconds: number;
}

/**
 * A fixed-width window centered on `centerSeconds`, slid (not shrunk) to stay within
 * `[0, domainDurationSeconds]` — clamping each edge independently would narrow the window near the
 * domain's start/end, which would zoom in further there than everywhere else. Mirrors the clamping
 * `Waveform.tsx`'s hover magnifier already does for the same reason.
 */
export function computeZoomWindowSeconds(centerSeconds: number, windowWidthSeconds: number, domainDurationSeconds: number): ZoomWindowSeconds {
  const clampedWidthSeconds = Math.min(windowWidthSeconds, domainDurationSeconds);
  const startSeconds = Math.min(Math.max(centerSeconds - clampedWidthSeconds / 2, 0), domainDurationSeconds - clampedWidthSeconds);

  return { startSeconds, endSeconds: startSeconds + clampedWidthSeconds };
}
