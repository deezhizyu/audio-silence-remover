import type { RefObject } from 'preact';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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

/** The left pane is the reference video as before, with a grey box overlay marking the zoomed region —
    shown only while the pointer is directly over the video or the canvas, not the gap between them. The
    right pane is a canvas continuously mirroring that cropped region from the same underlying `<video>`
    element — same idea as the waveform hover magnifier (`Waveform.tsx`'s `drawMagnifier`), just
    re-targeted at video frames instead of waveform bars, so there's only ever one real video decode.
    Scrolling over either pane zooms; dragging either pane pans the box — on the left that's a 1:1 move
    across the full frame, on the right it's scaled up by how zoomed in the box already is. */
export function AlignmentZoomableVideo({ videoElementRef }: AlignmentZoomableVideoProps) {
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const draggingPaneRef = useRef<'left' | 'right' | null>(null);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);

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

  const handleWheel = (event: JSX.TargetedWheelEvent<HTMLElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? -1 : 1;
    setZoomBoxSizeFraction(zoomBoxSizeFraction.value + direction * WHEEL_ZOOM_STEP_FRACTION);
  };

  const handlePointerDown = (pane: 'left' | 'right') => (event: JSX.TargetedPointerEvent<HTMLElement>) => {
    draggingPaneRef.current = pane;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
  };

  // On the left pane, the video's own rendered width/height *is* the full frame, so a pointer move maps
  // 1:1 to a frame fraction. On the right pane, the canvas only shows the zoomed box's own span, so the
  // same pointer movement covers a much smaller frame fraction — scaled down by the box's current size.
  const handlePointerMove = (event: JSX.TargetedPointerEvent<HTMLElement>) => {
    const pane = draggingPaneRef.current;
    if (!pane || !lastPointerPositionRef.current) return;
    const referenceElement = pane === 'left' ? videoElementRef.current : canvasContainerRef.current;
    if (!referenceElement) return;

    const deltaXPixels = event.clientX - lastPointerPositionRef.current.x;
    const deltaYPixels = event.clientY - lastPointerPositionRef.current.y;
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };

    const scaleFraction = pane === 'left' ? 1 : zoomBoxSizeFraction.value;
    const deltaXFraction = (deltaXPixels / Math.max(1, referenceElement.clientWidth)) * scaleFraction;
    const deltaYFraction = (deltaYPixels / Math.max(1, referenceElement.clientHeight)) * scaleFraction;
    const currentCenter = zoomBoxCenterFraction.value;
    setZoomBoxCenterFraction({ x: currentCenter.x + deltaXFraction, y: currentCenter.y + deltaYFraction });
  };

  const handlePointerUp = () => {
    draggingPaneRef.current = null;
    lastPointerPositionRef.current = null;
  };

  const boxStyle = {
    left: `${(boxCenter.x - boxSize / 2) * 100}%`,
    top: `${(boxCenter.y - boxSize / 2) * 100}%`,
    width: `${boxSize * 100}%`,
    height: `${boxSize * 100}%`,
  };

  return (
    <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <div ref={leftContainerRef} class="relative w-fit">
        <video
          ref={videoElementRef}
          src={videoSrc ?? undefined}
          draggable={false}
          class="block max-h-[420px] w-auto max-w-full touch-none rounded-lg border border-border-subtle bg-black"
          playsInline
          muted
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown('left')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div
          class={`pointer-events-none absolute rounded-sm border-2 border-white/70 bg-white/10 transition-opacity duration-200 ${
            isHovering ? 'opacity-100' : 'opacity-0'
          }`}
          style={boxStyle}
        />
      </div>

      <div ref={canvasContainerRef} class="overflow-hidden rounded-lg border border-border-subtle bg-black">
        <canvas
          ref={canvasRef}
          class="block h-full w-full touch-none"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown('right')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
