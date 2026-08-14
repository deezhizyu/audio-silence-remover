import { effect, type Signal } from '@preact/signals';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { SILENCE_CATEGORY_KEYS, type SilenceCategoryKey, type SilenceRegion } from '../audio/types';
import { SILENCE_CATEGORY_COLOR_VARS } from './silenceCategoryPresentation';
import { formatDurationClock } from '../utils/formatNumbers';
import { clampNumber } from '../utils/clampNumber';

interface WaveformProps {
  envelope: SerializedAmplitudeEnvelope;
  regions: SilenceRegion[];
  currentTimeSecondsSignal: Signal<number>;
  onSeek: (seconds: number) => void;
}

const WAVEFORM_HEIGHT_PIXELS = 160;
const SILENCE_OVERLAY_ALPHA = 0.3;
const REGION_BOUNDARY_ALPHA = 0.9;

const MAGNIFIER_WIDTH_PIXELS = 260;
const MAGNIFIER_WIDE_WIDTH_PIXELS = 340; // +80px, applied from the `xl` breakpoint up
const MAGNIFIER_WIDE_BREAKPOINT_QUERY = '(min-width: 1280px)'; // Tailwind's `xl` breakpoint
const MAGNIFIER_HEIGHT_PIXELS = 96;
// How far to either side of the hovered position (in main-canvas CSS pixels) the magnifier zooms into —
// deliberately screen-space rather than duration-based, so it stays "a little to the left/right of the
// cursor" regardless of how long the file is.
const MAGNIFIER_RADIUS_PIXELS = 35;

interface ThemeColors {
  waveform: string;
  playhead: string;
  silenceByCategory: Record<SilenceCategoryKey, string>;
}

function resolveThemeColors(referenceElement: Element): ThemeColors {
  const rootStyle = getComputedStyle(referenceElement);
  const silenceByCategory = Object.fromEntries(
    SILENCE_CATEGORY_KEYS.map(category => [category, rootStyle.getPropertyValue(SILENCE_CATEGORY_COLOR_VARS[category]).trim()]),
  ) as Record<SilenceCategoryKey, string>;

  return {
    waveform: rootStyle.getPropertyValue('--color-text-tertiary').trim(),
    playhead: rootStyle.getPropertyValue('--color-text-primary').trim(),
    silenceByCategory,
  };
}

function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

interface DrawSliceParams {
  widthPixels: number;
  heightPixels: number;
  startSeconds: number;
  endSeconds: number;
  envelope: SerializedAmplitudeEnvelope;
  regions: SilenceRegion[];
  themeColors: ThemeColors;
}

/**
 * Draws bars + silence overlays + region boundary lines for an arbitrary [startSeconds, endSeconds] window into
 * a canvas already sized/scaled by the caller. Shared by the full-file waveform and the hover magnifier so the
 * two stay pixel-for-pixel consistent instead of duplicating the peak-computation logic.
 */
function drawWaveformSlice(context: CanvasRenderingContext2D, params: DrawSliceParams): void {
  const { widthPixels, heightPixels, startSeconds, endSeconds, envelope, regions, themeColors } = params;
  const windowDurationSeconds = Math.max(endSeconds - startSeconds, 1e-6);
  const secondsToX = (seconds: number) => ((seconds - startSeconds) / windowDurationSeconds) * widthPixels;

  context.clearRect(0, 0, widthPixels, heightPixels);

  for (const region of regions) {
    const startX = secondsToX(region.startSeconds);
    const endX = secondsToX(region.endSeconds);
    if (endX < 0 || startX > widthPixels) continue;
    context.fillStyle = themeColors.silenceByCategory[region.category];
    context.globalAlpha = SILENCE_OVERLAY_ALPHA;
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
  // with the silence overlay the longer the file gets.
  context.fillStyle = themeColors.waveform;
  for (let pixelX = 0; pixelX < widthPixels; pixelX++) {
    const fractionStart = startFraction + (pixelX / widthPixels) * (endFraction - startFraction);
    const fractionEnd = startFraction + ((pixelX + 1) / widthPixels) * (endFraction - startFraction);
    const windowStart = Math.max(0, Math.floor(fractionStart * sampleCount));
    const windowEnd = Math.min(sampleCount, Math.max(windowStart + 1, Math.ceil(fractionEnd * sampleCount)));

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

  // Crisp boundary lines on top of the bars so the exact start/end of each detected silence is unambiguous,
  // rather than only readable from the soft translucent fill underneath.
  context.globalAlpha = REGION_BOUNDARY_ALPHA;
  context.lineWidth = 1.5;
  for (const region of regions) {
    context.strokeStyle = themeColors.silenceByCategory[region.category];
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
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{ pixelX: number; seconds: number } | null>(null);
  const hoverStateRef = useRef<{ pixelX: number; seconds: number } | null>(null);

  // The app ships one static theme (no dark/light toggle), so these CSS custom-property lookups never
  // change after first read — resolving them lazily once and caching here avoids re-running
  // `getComputedStyle` on every single mousemove while the hover magnifier is open.
  const themeColorsRef = useRef<ThemeColors | null>(null);
  const getThemeColors = (referenceElement: Element): ThemeColors => {
    if (!themeColorsRef.current) themeColorsRef.current = resolveThemeColors(referenceElement);
    return themeColorsRef.current;
  };

  const [isWideScreen, setIsWideScreen] = useState(() => window.matchMedia(MAGNIFIER_WIDE_BREAKPOINT_QUERY).matches);
  useEffect(() => {
    const mediaQueryList = window.matchMedia(MAGNIFIER_WIDE_BREAKPOINT_QUERY);
    const handleChange = () => setIsWideScreen(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);
  const magnifierWidthPixels = isWideScreen ? MAGNIFIER_WIDE_WIDTH_PIXELS : MAGNIFIER_WIDTH_PIXELS;

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

      drawWaveformSlice(context, {
        widthPixels,
        heightPixels: WAVEFORM_HEIGHT_PIXELS,
        startSeconds: 0,
        endSeconds: envelope.durationSeconds,
        envelope,
        regions,
        themeColors: getThemeColors(canvas),
      });
    };

    drawWaveform();

    // Coalesced to one redraw per animation frame: a burst of ResizeObserver callbacks (e.g. dragging a
    // window edge) would otherwise redraw the full waveform once per callback instead of once per frame.
    let resizeAnimationFrameId: number | null = null;
    const scheduleRedraw = () => {
      if (resizeAnimationFrameId !== null) return;
      resizeAnimationFrameId = requestAnimationFrame(() => {
        resizeAnimationFrameId = null;
        drawWaveform();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleRedraw);
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      if (resizeAnimationFrameId !== null) cancelAnimationFrame(resizeAnimationFrameId);
    };
  }, [envelope, regions]);

  // The magnifier canvas has a fixed on-screen size aside from the responsive width breakpoint above, so its
  // device-pixel backing store only needs setting up when that width changes — subsequent draws just redraw
  // its (otherwise unchanging) physical dimensions.
  useEffect(() => {
    const canvas = magnifierCanvasRef.current;
    if (!canvas) return;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = magnifierWidthPixels * devicePixelRatio;
    canvas.height = MAGNIFIER_HEIGHT_PIXELS * devicePixelRatio;
    canvas.style.width = `${magnifierWidthPixels}px`;
    canvas.style.height = `${MAGNIFIER_HEIGHT_PIXELS}px`;
    const context = canvas.getContext('2d');
    context?.scale(devicePixelRatio, devicePixelRatio);
  }, [magnifierWidthPixels]);

  const secondsAtPixel = (pixelX: number): number => {
    const widthPixels = containerRef.current?.clientWidth ?? 1;
    return clampFraction(pixelX / widthPixels) * envelope.durationSeconds;
  };

  const drawMagnifier = (pixelX: number, seconds: number) => {
    const magnifierCanvas = magnifierCanvasRef.current;
    const context = magnifierCanvas?.getContext('2d');
    if (!context) return;

    const widthPixels = Math.max(1, containerRef.current?.clientWidth ?? 1);
    // Window width stays fixed at 2x the radius (the zoom level), and only its position is clamped to the
    // waveform's bounds — clamping each edge independently instead would crop the window near the start/end,
    // shrinking the time span shown while it's still stretched across the same magnifier canvas, i.e. zooming
    // in further than everywhere else.
    const windowWidthPixels = Math.min(MAGNIFIER_RADIUS_PIXELS * 2, widthPixels);
    const windowStartPixel = clampNumber(pixelX - MAGNIFIER_RADIUS_PIXELS, 0, widthPixels - windowWidthPixels);
    const windowEndPixel = windowStartPixel + windowWidthPixels;
    const startSeconds = (windowStartPixel / widthPixels) * envelope.durationSeconds;
    const endSeconds = (windowEndPixel / widthPixels) * envelope.durationSeconds;
    const themeColors = getThemeColors(magnifierCanvas!);

    drawWaveformSlice(context, {
      widthPixels: magnifierWidthPixels,
      heightPixels: MAGNIFIER_HEIGHT_PIXELS,
      startSeconds,
      endSeconds,
      envelope,
      regions,
      themeColors,
    });

    const windowDurationSeconds = Math.max(endSeconds - startSeconds, 1e-6);

    // Dim hover marker: exactly where the cursor is pointing.
    const markerX = ((seconds - startSeconds) / windowDurationSeconds) * magnifierWidthPixels;
    context.strokeStyle = themeColors.playhead;
    context.lineWidth = 1;
    context.globalAlpha = 0.35;
    context.beginPath();
    context.moveTo(markerX, 0);
    context.lineTo(markerX, MAGNIFIER_HEIGHT_PIXELS);
    context.stroke();
    context.globalAlpha = 1;

    // Bright glowing play cursor: the actual playback position, when it's inside the zoomed window — mirrors
    // the main waveform's PlayheadLine so it reads as "the same cursor, zoomed in" rather than a new element.
    const currentPlaySeconds = currentTimeSecondsSignal.value;
    if (currentPlaySeconds >= startSeconds && currentPlaySeconds <= endSeconds) {
      const cursorX = ((currentPlaySeconds - startSeconds) / windowDurationSeconds) * magnifierWidthPixels;
      context.save();
      context.shadowColor = 'rgba(255, 255, 255, 0.55)';
      context.shadowBlur = 6;
      context.strokeStyle = themeColors.playhead;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(cursorX, 0);
      context.lineTo(cursorX, MAGNIFIER_HEIGHT_PIXELS);
      context.stroke();
      context.restore();
    }
  };

  const handleClick = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    onSeek(secondsAtPixel(event.offsetX));
  };

  // Native mousemove can fire well above the display's refresh rate; coalescing to one update per
  // animation frame (keeping only the latest position) avoids redundant state updates and magnifier
  // redraws without changing what ends up on screen.
  const pendingHoverPositionRef = useRef<{ pixelX: number; seconds: number } | null>(null);
  const hoverAnimationFrameIdRef = useRef<number | null>(null);

  const flushPendingHover = () => {
    hoverAnimationFrameIdRef.current = null;
    const pending = pendingHoverPositionRef.current;
    if (!pending) return;
    hoverStateRef.current = pending;
    setHoverState(pending);
    drawMagnifier(pending.pixelX, pending.seconds);
  };

  const handleMouseMove = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    const pixelX = event.offsetX;
    const seconds = secondsAtPixel(pixelX);
    pendingHoverPositionRef.current = { pixelX, seconds };
    if (hoverAnimationFrameIdRef.current === null) {
      hoverAnimationFrameIdRef.current = requestAnimationFrame(flushPendingHover);
    }
  };

  const handleMouseLeave = () => {
    if (hoverAnimationFrameIdRef.current !== null) {
      cancelAnimationFrame(hoverAnimationFrameIdRef.current);
      hoverAnimationFrameIdRef.current = null;
    }
    pendingHoverPositionRef.current = null;
    hoverStateRef.current = null;
    setHoverState(null);
  };

  // Touch is a press-and-hold-to-scrub gesture rather than a tap-to-seek one: touchstart/touchmove only open
  // the magnifier and track the finger (mirroring hover), and the seek+play only fires once on release — so
  // holding a finger down to preview a position never starts playback from wherever the press began.
  const updateHoverFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pixelX = clampNumber(clientX - rect.left, 0, rect.width);
    const seconds = secondsAtPixel(pixelX);
    pendingHoverPositionRef.current = { pixelX, seconds };
    if (hoverAnimationFrameIdRef.current === null) {
      hoverAnimationFrameIdRef.current = requestAnimationFrame(flushPendingHover);
    }
  };

  const handleTouchStart = (event: JSX.TargetedTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) updateHoverFromClientX(touch.clientX);
  };

  const handleTouchMove = (event: JSX.TargetedTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) updateHoverFromClientX(touch.clientX);
  };

  const handleTouchEnd = (event: JSX.TargetedTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    const finalHover = hoverStateRef.current;
    handleMouseLeave();
    if (finalHover) onSeek(finalHover.seconds);
  };

  const handleTouchCancel = () => {
    handleMouseLeave();
  };

  useEffect(() => {
    return () => {
      if (hoverAnimationFrameIdRef.current !== null) cancelAnimationFrame(hoverAnimationFrameIdRef.current);
    };
  }, []);

  // Keeps the magnifier's play cursor moving while the file is playing and the magnifier stays open, instead
  // of only updating on the next mouse move.
  useEffect(() => {
    return effect(() => {
      void currentTimeSecondsSignal.value;
      if (hoverStateRef.current) drawMagnifier(hoverStateRef.current.pixelX, hoverStateRef.current.seconds);
    });
  }, [envelope, regions, magnifierWidthPixels]);

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const magnifierLeft = hoverState
    ? Math.min(Math.max(hoverState.pixelX, magnifierWidthPixels / 2), Math.max(containerWidth - magnifierWidthPixels / 2, magnifierWidthPixels / 2))
    : containerWidth / 2;

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      class="group relative w-full touch-none cursor-pointer overflow-visible rounded-lg border border-border-subtle bg-surface-raised transition-colors duration-200 hover:border-border-strong"
    >
      <div class="overflow-hidden rounded-lg">
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

      <div
        class={`pointer-events-none absolute z-20 origin-bottom -translate-x-1/2 overflow-hidden rounded-lg border border-border-strong bg-surface-overlay shadow-[0_16px_32px_-18px_rgba(0,0,0,0.6)] transition duration-150 ease-out ${
          hoverState ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-95 opacity-0'
        }`}
        style={{ left: `${magnifierLeft}px`, bottom: `calc(100% + 10px)`, width: magnifierWidthPixels, height: MAGNIFIER_HEIGHT_PIXELS }}
      >
        <canvas ref={magnifierCanvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
