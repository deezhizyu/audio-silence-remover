import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';

export interface WaveformHighlightRegion {
  startSeconds: number;
  endSeconds: number;
  color: string;
}

export interface DrawWaveformSliceParams {
  widthPixels: number;
  heightPixels: number;
  startSeconds: number;
  endSeconds: number;
  envelope: SerializedAmplitudeEnvelope;
  highlightRegions: WaveformHighlightRegion[];
  waveformColor: string;
}

const HIGHLIGHT_OVERLAY_ALPHA = 0.3;
const HIGHLIGHT_BOUNDARY_ALPHA = 0.9;

/**
 * Draws bars + highlighted regions for an arbitrary [startSeconds, endSeconds] window into a canvas
 * already sized/scaled by the caller. Shared across every waveform view in the app — the interactive
 * silence-remover waveform (and its hover magnifier) and the audio-alignment page's static per-source
 * waveforms — so the peak-computation/bar-drawing logic exists in exactly one place.
 */
export function drawWaveformSlice(context: CanvasRenderingContext2D, params: DrawWaveformSliceParams): void {
  const { widthPixels, heightPixels, startSeconds, endSeconds, envelope, highlightRegions, waveformColor } = params;
  const windowDurationSeconds = Math.max(endSeconds - startSeconds, 1e-6);
  const secondsToX = (seconds: number) => ((seconds - startSeconds) / windowDurationSeconds) * widthPixels;

  context.clearRect(0, 0, widthPixels, heightPixels);

  for (const region of highlightRegions) {
    const startX = secondsToX(region.startSeconds);
    const endX = secondsToX(region.endSeconds);
    if (endX < 0 || startX > widthPixels) continue;
    context.fillStyle = region.color;
    context.globalAlpha = HIGHLIGHT_OVERLAY_ALPHA;
    context.fillRect(startX, 0, Math.max(1, endX - startX), heightPixels);
  }
  context.globalAlpha = 1;

  const rootMeanSquarePerWindow = envelope.rootMeanSquarePerWindow;
  const sampleCount = rootMeanSquarePerWindow.length;
  const centerY = heightPixels / 2;
  const maxBarHalfHeight = heightPixels / 2 - Math.min(4, heightPixels / 8);
  const startFraction = startSeconds / envelope.durationSeconds;
  const endFraction = endSeconds / envelope.durationSeconds;

  // Each pixel's window range is derived from the same continuous (pixel / width) fraction that `secondsToX`
  // uses, rather than a fixed integer step size. A fixed step size under-covers the envelope on long files (its
  // floor-rounding error accumulates across the canvas), which drifts the rendered waveform shape out of sync
  // with the highlight overlays the longer the file gets.
  context.fillStyle = waveformColor;
  for (let pixelX = 0; pixelX < widthPixels; pixelX++) {
    const fractionStart = startFraction + (pixelX / widthPixels) * (endFraction - startFraction);
    const fractionEnd = startFraction + ((pixelX + 1) / widthPixels) * (endFraction - startFraction);

    // A pixel whose fraction range falls partly or fully outside [0, 1] is asking for time outside the
    // envelope's own duration (e.g. previewing where silence would be inserted before a shifted clip's
    // real frame 0) — clamp the *lookup* range rather than the fraction range itself, so that portion
    // renders as true silence instead of a smeared repeat of whichever edge sample is nearest.
    const clampedFractionStart = Math.max(0, fractionStart);
    const clampedFractionEnd = Math.min(1, fractionEnd);

    let peakAmplitudeInWindow = 0;
    if (clampedFractionEnd > clampedFractionStart) {
      const windowStart = Math.max(0, Math.floor(clampedFractionStart * sampleCount));
      const windowEnd = Math.min(sampleCount, Math.max(windowStart + 1, Math.ceil(clampedFractionEnd * sampleCount)));
      for (let windowIndex = windowStart; windowIndex < windowEnd; windowIndex++) {
        if (rootMeanSquarePerWindow[windowIndex] > peakAmplitudeInWindow) {
          peakAmplitudeInWindow = rootMeanSquarePerWindow[windowIndex];
        }
      }
    }

    const normalizedPeak = Math.min(1, peakAmplitudeInWindow / envelope.peakAmplitude);
    const barHalfHeight = Math.max(0.75, normalizedPeak * maxBarHalfHeight);
    context.fillRect(pixelX, centerY - barHalfHeight, 1, barHalfHeight * 2);
  }

  // Crisp boundary lines on top of the bars so the exact start/end of each highlighted region is unambiguous,
  // rather than only readable from the soft translucent fill underneath.
  context.globalAlpha = HIGHLIGHT_BOUNDARY_ALPHA;
  context.lineWidth = 1.5;
  for (const region of highlightRegions) {
    context.strokeStyle = region.color;
    for (const boundarySeconds of [region.startSeconds, region.endSeconds]) {
      const x = secondsToX(boundarySeconds);
      if (x < -1 || x > widthPixels + 1) continue;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, heightPixels);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
}
