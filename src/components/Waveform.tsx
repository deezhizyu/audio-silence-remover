import type { Signal } from '@preact/signals';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { SILENCE_CATEGORY_KEYS, type SilenceCategoryKey, type SilenceRegion } from '../audio/types';
import { SILENCE_CATEGORY_COLOR_VARS } from './silenceCategoryPresentation';
import { formatDurationClock } from '../utils/formatNumbers';

interface WaveformProps {
  envelope: SerializedAmplitudeEnvelope;
  regions: SilenceRegion[];
  currentTimeSecondsSignal: Signal<number>;
  onSeek: (seconds: number) => void;
}

const WAVEFORM_HEIGHT_PIXELS = 160;
const SILENCE_OVERLAY_ALPHA = 0.24;

function resolveThemeColors(referenceElement: Element): { waveform: string; silenceByCategory: Record<SilenceCategoryKey, string> } {
  const rootStyle = getComputedStyle(referenceElement);
  const silenceByCategory = Object.fromEntries(
    SILENCE_CATEGORY_KEYS.map(category => [category, rootStyle.getPropertyValue(SILENCE_CATEGORY_COLOR_VARS[category]).trim()]),
  ) as Record<SilenceCategoryKey, string>;

  return { waveform: rootStyle.getPropertyValue('--color-text-tertiary').trim(), silenceByCategory };
}

function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/** Reads the playback time signal directly, so only this thin line re-renders on every animation frame. */
function PlayheadLine({ currentTimeSecondsSignal, durationSeconds }: { currentTimeSecondsSignal: Signal<number>; durationSeconds: number }) {
  const fraction = durationSeconds > 0 ? clampFraction(currentTimeSecondsSignal.value / durationSeconds) : 0;
  return (
    <div
      class="pointer-events-none absolute inset-y-0 z-10 w-px bg-text-primary shadow-[0_0_6px_1px_rgba(255,255,255,0.45)]"
      style={{ left: `${fraction * 100}%` }}
    />
  );
}

export function Waveform({ envelope, regions, currentTimeSecondsSignal, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{ pixelX: number; seconds: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const drawWaveform = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const widthPixels = Math.max(1, container.clientWidth);
      canvas.width = widthPixels * devicePixelRatio;
      canvas.height = WAVEFORM_HEIGHT_PIXELS * devicePixelRatio;
      canvas.style.width = `${widthPixels}px`;
      canvas.style.height = `${WAVEFORM_HEIGHT_PIXELS}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(devicePixelRatio, devicePixelRatio);
      context.clearRect(0, 0, widthPixels, WAVEFORM_HEIGHT_PIXELS);

      const themeColors = resolveThemeColors(canvas);
      const secondsToX = (seconds: number) => (seconds / envelope.durationSeconds) * widthPixels;

      for (const region of regions) {
        const startX = secondsToX(region.startSeconds);
        const endX = secondsToX(region.endSeconds);
        context.fillStyle = themeColors.silenceByCategory[region.category];
        context.globalAlpha = SILENCE_OVERLAY_ALPHA;
        context.fillRect(startX, 0, Math.max(1, endX - startX), WAVEFORM_HEIGHT_PIXELS);
      }
      context.globalAlpha = 1;

      const rootMeanSquarePerWindow = envelope.rootMeanSquarePerWindow;
      const centerY = WAVEFORM_HEIGHT_PIXELS / 2;
      const maxBarHalfHeight = WAVEFORM_HEIGHT_PIXELS / 2 - 4;

      // Each pixel's window range is derived from the same continuous (pixel / width) fraction that
      // `secondsToX` uses, rather than a fixed integer step size. A fixed step size under-covers the
      // envelope on long files (its floor-rounding error accumulates across the canvas), which drifts
      // the rendered waveform shape out of sync with the silence overlay the longer the file gets.
      context.fillStyle = themeColors.waveform;
      for (let pixelX = 0; pixelX < widthPixels; pixelX++) {
        const windowStart = Math.floor((pixelX / widthPixels) * rootMeanSquarePerWindow.length);
        const windowEnd = Math.min(
          rootMeanSquarePerWindow.length,
          Math.max(windowStart + 1, Math.floor(((pixelX + 1) / widthPixels) * rootMeanSquarePerWindow.length)),
        );

        let peakAmplitudeInWindow = 0;
        for (let windowIndex = windowStart; windowIndex < windowEnd; windowIndex++) {
          if (rootMeanSquarePerWindow[windowIndex] > peakAmplitudeInWindow) {
            peakAmplitudeInWindow = rootMeanSquarePerWindow[windowIndex];
          }
        }

        const normalizedPeak = Math.min(1, peakAmplitudeInWindow / envelope.peakAmplitude);
        const barHalfHeight = Math.max(0.75, normalizedPeak * maxBarHalfHeight);
        context.fillRect(pixelX, centerY - barHalfHeight, 1, barHalfHeight * 2);
      }
    };

    drawWaveform();

    const resizeObserver = new ResizeObserver(drawWaveform);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [envelope, regions]);

  const secondsAtPixel = (pixelX: number): number => {
    const widthPixels = containerRef.current?.clientWidth ?? 1;
    return clampFraction(pixelX / widthPixels) * envelope.durationSeconds;
  };

  const handleClick = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    onSeek(secondsAtPixel(event.offsetX));
  };

  const handleMouseMove = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    setHoverState({ pixelX: event.offsetX, seconds: secondsAtPixel(event.offsetX) });
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverState(null)}
      class="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-border-subtle bg-surface-raised transition-colors duration-200 hover:border-border-strong"
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${WAVEFORM_HEIGHT_PIXELS}px` }} />
      <PlayheadLine currentTimeSecondsSignal={currentTimeSecondsSignal} durationSeconds={envelope.durationSeconds} />
      {hoverState && (
        <>
          <div class="pointer-events-none absolute inset-y-0 w-px bg-text-primary/25" style={{ left: `${hoverState.pixelX}px` }} />
          <div
            class="pointer-events-none absolute top-2 -translate-x-1/2 rounded border border-border-strong bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-text-secondary opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ left: `${hoverState.pixelX}px` }}
          >
            {formatDurationClock(hoverState.seconds)}
          </div>
        </>
      )}
    </div>
  );
}
