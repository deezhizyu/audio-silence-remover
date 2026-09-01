import { useEffect, useRef } from 'preact/hooks';
import { formatDurationClock } from '../utils/formatNumbers';
import {
  activePlaybackSource,
  attachPlaybackVideoElement,
  isPlaybackPlaying,
  originalVideoDurationSeconds,
  pausePlayback,
  playbackCurrentTimeSeconds,
  playOriginalAudio,
  playVoiceChangedAudio,
  seekPlayback,
  videoObjectUrl,
} from '../state/audioAlignmentSignals';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface AlignmentPlaybackPreviewProps {
  voiceChangedReady: boolean;
}

/** The video's picture plays under whichever audio source is selected — never both at once. "Original"
    plays the video's own native embedded audio track; "Voice-changed" mutes the video and instead
    schedules the voice-changed buffer through Web Audio, using the current offset/trim values (see
    AlignmentPreviewPlaybackController). Switching sources mid-playback keeps the same position. */
export function AlignmentPlaybackPreview({ voiceChangedReady }: AlignmentPlaybackPreviewProps) {
  const videoElementRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachPlaybackVideoElement(videoElementRef.current);
    return () => attachPlaybackVideoElement(null);
  }, []);

  const activeSource = activePlaybackSource.value;
  const isPlaying = isPlaybackPlaying.value;
  const videoSrc = videoObjectUrl.value;

  const handleToggleOriginal = () => {
    if (activeSource === 'original' && isPlaying) {
      pausePlayback();
    } else {
      playOriginalAudio();
    }
  };

  const handleToggleVoiceChanged = () => {
    if (activeSource === 'voiceChanged' && isPlaying) {
      pausePlayback();
    } else {
      playVoiceChangedAudio();
    }
  };

  const handleRestart = () => {
    seekPlayback(0);
    if (activeSource === 'voiceChanged') {
      playVoiceChangedAudio(0);
    } else {
      playOriginalAudio(0);
    }
  };

  return (
    <Card>
      <video ref={videoElementRef} src={videoSrc ?? undefined} class="w-full rounded-lg border border-border-subtle bg-black" playsInline muted />

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <Button variant="ghost" onClick={handleRestart}>
            ⏮ Restart
          </Button>
          <Button variant={activeSource === 'original' && isPlaying ? 'primary' : 'secondary'} onClick={handleToggleOriginal}>
            {activeSource === 'original' && isPlaying ? 'Pause' : 'Play'} original
          </Button>
          <Button
            variant={activeSource === 'voiceChanged' && isPlaying ? 'primary' : 'secondary'}
            onClick={handleToggleVoiceChanged}
            disabled={!voiceChangedReady}
          >
            {activeSource === 'voiceChanged' && isPlaying ? 'Pause' : 'Play'} voice-changed
          </Button>
        </div>

        <span class="font-mono text-xs tabular-nums text-text-secondary">
          {formatDurationClock(playbackCurrentTimeSeconds.value)}
          <span class="text-text-tertiary"> / {formatDurationClock(originalVideoDurationSeconds.value)}</span>
        </span>
      </div>
    </Card>
  );
}
