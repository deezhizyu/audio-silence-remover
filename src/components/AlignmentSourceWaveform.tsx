import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { clampNumber } from '../utils/clampNumber';
import { drawWaveformSlice, type WaveformHighlightRegion } from './waveformDrawing';

interface AlignmentSourceWaveformProps {
  label: string;
  envelope: SerializedAmplitudeEnvelope;
  windowStartSeconds: number;
  windowEndSeconds: number;
  highlightRegions: WaveformHighlightRegion[];
  /** In this waveform's own timeline (the caller converts from the shared/original one) — `null` hides the line. */
  playheadSeconds: number | null;
  onSeek: (secondsInThisWindow: number) => void;
}

const WAVEFORM_HEIGHT_PIXELS = 120;
const ZOOM_ANIMATION_DURATION_MILLISECONDS = 250;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** An interactive per-source waveform: renders whatever `[windowStartSeconds, windowEndSeconds]` window
    the caller hands it (the full duration when zoomed out, a few seconds when zoomed in), animating
    smoothly between windows on change so a zoom-in/out reads as a single continuous motion rather than a
    jump cut. Clicking or dragging anywhere reports back a position in this waveform's own timeline,
    continuously while dragging so scrubbing reads as one smooth motion. */
export function AlignmentSourceWaveform({
  label,
  envelope,
  windowStartSeconds,
  windowEndSeconds,
  highlightRegions,
  playheadSeconds,
  onSeek,
}: AlignmentSourceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedWindowRef = useRef({ startSeconds: windowStartSeconds, endSeconds: windowEndSeconds });
  const zoomAnimationFrameIdRef = useRef<number | null>(null);
  const waveformColorRef = useRef<string | null>(null);
  const playheadColorRef = useRef<string | null>(null);

  // The playhead is drawn on the canvas itself (rather than as a positioned DOM element) specifically so
  // it stays in sync with `renderedWindowRef` while that's being animated by the zoom transition below —
  // a DOM overlay driven by a ref wouldn't move between Preact renders the way an imperative canvas draw does.
  const draw = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const widthPixels = Math.max(1, container.clientWidth);
    canvas.width = widthPixels * devicePixelRatio;
    canvas.height = WAVEFORM_HEIGHT_PIXELS * devicePixelRatio;
    canvas.style.width = `${widthPixels}px`;
    canvas.style.height = `${WAVEFORM_HEIGHT_PIXELS}px`;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(devicePixelRatio, devicePixelRatio);

    if (!waveformColorRef.current) waveformColorRef.current = getComputedStyle(canvas).getPropertyValue('--color-text-tertiary').trim();
    if (!playheadColorRef.current) playheadColorRef.current = getComputedStyle(canvas).getPropertyValue('--color-text-primary').trim();

    const { startSeconds, endSeconds } = renderedWindowRef.current;
    drawWaveformSlice(context, {
      widthPixels,
      heightPixels: WAVEFORM_HEIGHT_PIXELS,
      startSeconds,
      endSeconds,
      envelope,
      highlightRegions,
      waveformColor: waveformColorRef.current,
    });

    const windowDurationSeconds = endSeconds - startSeconds;
    if (playheadSeconds !== null && windowDurationSeconds > 0 && playheadSeconds >= startSeconds && playheadSeconds <= endSeconds) {
      const playheadX = ((playheadSeconds - startSeconds) / windowDurationSeconds) * widthPixels;
      context.strokeStyle = playheadColorRef.current;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(playheadX, 0);
      context.lineTo(playheadX, WAVEFORM_HEIGHT_PIXELS);
      context.stroke();
    }
  };

  // Animates the *rendered* window from wherever it currently is to the new target window whenever the
  // caller hands us a new one (a zoom in/out or an offset-slider-driven shift) — this is what makes the
  // zoom read as smooth motion rather than an instant jump.
  useEffect(() => {
    if (zoomAnimationFrameIdRef.current !== null) cancelAnimationFrame(zoomAnimationFrameIdRef.current);

    const startingWindow = { ...renderedWindowRef.current };
    const targetWindow = { startSeconds: windowStartSeconds, endSeconds: windowEndSeconds };
    const animationStartTime = performance.now();

    const step = (now: number) => {
      const rawProgress = clampNumber((now - animationStartTime) / ZOOM_ANIMATION_DURATION_MILLISECONDS, 0, 1);
      const easedProgress = easeOutCubic(rawProgress);

      renderedWindowRef.current = {
        startSeconds: startingWindow.startSeconds + (targetWindow.startSeconds - startingWindow.startSeconds) * easedProgress,
        endSeconds: startingWindow.endSeconds + (targetWindow.endSeconds - startingWindow.endSeconds) * easedProgress,
      };
      draw();

      if (rawProgress < 1) {
        zoomAnimationFrameIdRef.current = requestAnimationFrame(step);
      } else {
        zoomAnimationFrameIdRef.current = null;
      }
    };

    zoomAnimationFrameIdRef.current = requestAnimationFrame(step);
    return () => {
      if (zoomAnimationFrameIdRef.current !== null) cancelAnimationFrame(zoomAnimationFrameIdRef.current);
    };
    // Only the window bounds should trigger the animated transition — see the redraw-only effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStartSeconds, windowEndSeconds]);

  // Immediate (non-animated) redraw for anything that isn't a window change: new highlight regions from a
  // trim-slider drag, a new playhead tick during normal playback, or a resize.
  useEffect(() => {
    draw();
    let resizeAnimationFrameId: number | null = null;
    const scheduleRedraw = () => {
      if (resizeAnimationFrameId !== null) return;
      resizeAnimationFrameId = requestAnimationFrame(() => {
        resizeAnimationFrameId = null;
        draw();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleRedraw);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      if (resizeAnimationFrameId !== null) cancelAnimationFrame(resizeAnimationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelope, highlightRegions, playheadSeconds]);

  const isDraggingRef = useRef(false);

  const emitSeekFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const widthPixels = rect?.width ?? 1;
    const { startSeconds, endSeconds } = renderedWindowRef.current;
    const fraction = clampNumber(((clientX - (rect?.left ?? 0)) / widthPixels), 0, 1);
    onSeek(startSeconds + fraction * (endSeconds - startSeconds));
  };

  const handlePointerDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    emitSeekFromClientX(event.clientX);
  };

  const handlePointerMove = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    emitSeekFromClientX(event.clientX);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-text-secondary">{label}</span>
        <span class="font-mono tabular-nums text-text-tertiary">{envelope.durationSeconds.toFixed(2)}s</span>
      </div>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        class="relative cursor-grab overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay transition-colors duration-200 hover:border-border-strong active:cursor-grabbing"
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${WAVEFORM_HEIGHT_PIXELS}px` }} />
      </div>
    </div>
  );
}
