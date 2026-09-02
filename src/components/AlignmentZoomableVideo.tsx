import type { RefObject } from 'preact';
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { computeZoomBoxPixelRect } from '../utils/computeZoomBoxRect';
import {
  previewVideoObjectUrl,
  setZoomBoxCenterFraction,
  setZoomBoxSizeFraction,
  zoomBoxCenterFraction,
  zoomBoxSizeFraction,
} from '../state/audioAlignmentSignals';

interface AlignmentZoomableVideoProps {
  videoElementRef: RefObject<HTMLVideoElement>;
}

const WHEEL_ZOOM_STEP_FRACTION = 0.03;

/** The left pane is the reference video as before, with a grey box overlay marking the zoomed region
    (shown only while hovering either pane). The right pane is a canvas continuously mirroring that
    cropped region from the same underlying `<video>` element — same idea as the waveform hover
    magnifier (`Waveform.tsx`'s `drawMagnifier`), just re-targeted at video frames instead of waveform
    bars, so there's only ever one real video decode. Scroll zooms (either pane); dragging the right
    pane pans the box. */
export function AlignmentZoomableVideo({ videoElementRef }: AlignmentZoomableVideoProps) {
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  const videoSrc = previewVideoObjectUrl.value;
  const boxCenter = zoomBoxCenterFraction.value;
  const boxSize = zoomBoxSizeFraction.value;

  // Keeps the right pane's box the same on-screen size/shape as the left video's own rendered box (the
  // video element sizes itself to its own aspect ratio, so no letterboxing math is needed here).
  useEffect(() => {
    const videoElement = videoElementRef.current;
    const canvasContainer = canvasContainerRef.current;
    if (!videoElement || !canvasContainer) return;

    const syncSize = () => {
      const width = videoElement.clientWidth;
      const height = videoElement.clientHeight;
      if (width > 0 && height > 0) {
        canvasContainer.style.width = `${width}px`;
        canvasContainer.style.height = `${height}px`;
      }
    };

    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(videoElement);
    return () => resizeObserver.disconnect();
  }, [videoElementRef, videoSrc]);

  // One rAF loop for the component's lifetime, redrawing every frame regardless of play state — simpler
  // and more robust than trying to separately handle "playing", "paused but scrubbing", and "box/zoom
  // changed while paused".
  useEffect(() => {
    const draw = () => {
      animationFrameIdRef.current = requestAnimationFrame(draw);

      const videoElement = videoElementRef.current;
      const canvas = canvasRef.current;
      const canvasContainer = canvasContainerRef.current;
      if (!videoElement || !canvas || !canvasContainer || videoElement.readyState < 2) return;

      const devicePixelRatio = window.devicePixelRatio || 1;
      const widthPixels = Math.max(1, canvasContainer.clientWidth);
      const heightPixels = Math.max(1, canvasContainer.clientHeight);
      const backingWidth = Math.round(widthPixels * devicePixelRatio);
      const backingHeight = Math.round(heightPixels * devicePixelRatio);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      const { sx, sy, sw, sh } = computeZoomBoxPixelRect(
        zoomBoxCenterFraction.value,
        zoomBoxSizeFraction.value,
        videoElement.videoWidth,
        videoElement.videoHeight,
      );
      if (sw <= 0 || sh <= 0) return;
      context.drawImage(videoElement, sx, sy, sw, sh, 0, 0, widthPixels, heightPixels);
    };

    animationFrameIdRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [videoElementRef]);

  const handleWheel = (event: JSX.TargetedWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? -1 : 1;
    setZoomBoxSizeFraction(zoomBoxSizeFraction.value + direction * WHEEL_ZOOM_STEP_FRACTION);
  };

  const handlePointerDown = (event: JSX.TargetedPointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: JSX.TargetedPointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !lastPointerPositionRef.current) return;
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer) return;

    const deltaXPixels = event.clientX - lastPointerPositionRef.current.x;
    const deltaYPixels = event.clientY - lastPointerPositionRef.current.y;
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };

    const sizeFraction = zoomBoxSizeFraction.value;
    const deltaXFraction = (deltaXPixels / Math.max(1, canvasContainer.clientWidth)) * sizeFraction;
    const deltaYFraction = (deltaYPixels / Math.max(1, canvasContainer.clientHeight)) * sizeFraction;
    const currentCenter = zoomBoxCenterFraction.value;
    setZoomBoxCenterFraction({ x: currentCenter.x + deltaXFraction, y: currentCenter.y + deltaYFraction });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    lastPointerPositionRef.current = null;
  };

  const boxStyle = {
    left: `${(boxCenter.x - boxSize / 2) * 100}%`,
    top: `${(boxCenter.y - boxSize / 2) * 100}%`,
    width: `${boxSize * 100}%`,
    height: `${boxSize * 100}%`,
  };

  return (
    <div class="group flex flex-col items-center justify-center gap-4 sm:flex-row" onWheel={handleWheel}>
      <div ref={leftContainerRef} class="relative w-fit">
        <video
          ref={videoElementRef}
          src={videoSrc ?? undefined}
          class="block max-h-[420px] w-auto max-w-full rounded-lg border border-border-subtle bg-black"
          playsInline
          muted
        />
        <div
          class="pointer-events-none absolute rounded-sm border-2 border-white/70 bg-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={boxStyle}
        />
      </div>

      <div ref={canvasContainerRef} class="overflow-hidden rounded-lg border border-border-subtle bg-black">
        <canvas
          ref={canvasRef}
          class="block h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
