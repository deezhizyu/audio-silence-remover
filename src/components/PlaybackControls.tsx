import type { Signal } from '@preact/signals';
import { formatDurationClock } from '../utils/formatNumbers';

interface PlaybackControlsProps {
  isPlayingSignal: Signal<boolean>;
  currentTimeSecondsSignal: Signal<number>;
  durationSeconds: number;
  onTogglePlayback: () => void;
  onRestart: () => void;
}

export function PlaybackControls({
  isPlayingSignal,
  currentTimeSecondsSignal,
  durationSeconds,
  onTogglePlayback,
  onRestart,
}: PlaybackControlsProps) {
  const isPlaying = isPlayingSignal.value;

  return (
    <div class="flex items-center justify-between">
      <span class="font-mono text-xs tabular-nums text-text-secondary">
        {formatDurationClock(currentTimeSecondsSignal.value)}
        <span class="text-text-tertiary"> / {formatDurationClock(durationSeconds)}</span>
      </span>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRestart}
          aria-label="Skip to beginning"
          class="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-all duration-200 hover:bg-surface-overlay hover:text-text-primary active:scale-90"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
            <rect x="4" y="4" width="2" height="12" rx="1" />
            <path d="M16 4.6a1 1 0 0 0-1.53-.85l-7.7 4.9a1.5 1.5 0 0 0 0 2.5l7.7 4.9A1 1 0 0 0 16 15V4.6Z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onTogglePlayback}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          class="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent text-surface-base shadow-[0_10px_24px_-10px_var(--color-accent)] transition-transform duration-200 ease-out hover:scale-105 active:scale-95"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            class={`absolute h-4 w-4 translate-x-px transition-all duration-200 ${isPlaying ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`}
          >
            <path d="M6.5 4.3a1 1 0 0 1 1.5-.87l9 5.7a1 1 0 0 1 0 1.74l-9 5.7a1 1 0 0 1-1.5-.87V4.3Z" />
          </svg>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            class={`absolute h-4 w-4 transition-all duration-200 ${isPlaying ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
          >
            <path d="M6 4a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm7 0a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
