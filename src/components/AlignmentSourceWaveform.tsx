import { useEffect, useRef } from 'preact/hooks';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { formatDurationClock } from '../utils/formatNumbers';
import { drawWaveformSlice, type WaveformHighlightRegion } from './waveformDrawing';

interface AlignmentSourceWaveformProps {
  label: string;
  envelope: SerializedAmplitudeEnvelope;
  highlightRegions: WaveformHighlightRegion[];
}

const WAVEFORM_HEIGHT_PIXELS = 96;

/** A lean, non-interactive waveform for the audio-alignment page — no hover magnifier, no click-to-seek,
    since this page has no audio player to scrub. Just the bars plus whatever highlight regions the caller
    hands it, built on the same drawing logic the interactive silence-remover waveform uses. */
export function AlignmentSourceWaveform({ label, envelope, highlightRegions }: AlignmentSourceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const widthPixels = Math.max(1, container.clientWidth);
      canvas.width = widthPixels * devicePixelRatio;
      canvas.height = WAVEFORM_HEIGHT_PIXELS * devicePixelRatio;
      canvas.style.width = `${widthPixels}px`;
      canvas.style.height = `${WAVEFORM_HEIGHT_PIXELS}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(devicePixelRatio, devicePixelRatio);

      const waveformColor = getComputedStyle(canvas).getPropertyValue('--color-text-tertiary').trim();
      drawWaveformSlice(context, {
        widthPixels,
        heightPixels: WAVEFORM_HEIGHT_PIXELS,
        startSeconds: 0,
        endSeconds: envelope.durationSeconds,
        envelope,
        highlightRegions,
        waveformColor,
      });
    };

    draw();

    // Coalesced to one redraw per animation frame, matching the interactive waveform's own resize handling.
    let resizeAnimationFrameId: number | null = null;
    const scheduleRedraw = () => {
      if (resizeAnimationFrameId !== null) return;
      resizeAnimationFrameId = requestAnimationFrame(() => {
        resizeAnimationFrameId = null;
        draw();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleRedraw);
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      if (resizeAnimationFrameId !== null) cancelAnimationFrame(resizeAnimationFrameId);
    };
  }, [envelope, highlightRegions]);

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-text-secondary">{label}</span>
        <span class="font-mono tabular-nums text-text-tertiary">{formatDurationClock(envelope.durationSeconds)}</span>
      </div>
      <div ref={containerRef} class="overflow-hidden rounded-lg border border-border-subtle bg-surface-overlay">
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${WAVEFORM_HEIGHT_PIXELS}px` }} />
      </div>
    </div>
  );
}
