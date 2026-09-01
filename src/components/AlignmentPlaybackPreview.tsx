import { useEffect, useRef } from 'preact/hooks';
import { formatDurationClock } from '../utils/formatNumbers';
import {
  attachPlaybackVideoElement,
  isPlaybackPlaying,
  offsetSeconds,
  pausePreview,
  playbackCurrentTimeSeconds,
  playPreview,
  previewVideoObjectUrl,
  seekPreview,
  updateOffsetSeconds,
} from '../state/audioAlignmentSignals';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { RangeControl } from './ui/RangeControl';
import { SectionHeading } from './ui/SectionHeading';

const OFFSET_RANGE_SECONDS = 10;

/** Previews the first matched pair: the video's picture always plays muted alongside the voice-changed
    audio, scheduled with the current offset — there's no toggle back to the original audio, since the
    point of this preview is to check the swapped-in audio lines up, not to compare the two. Sized to a
    sane, fixed width rather than stretched to match a sibling panel — there's nothing beside it to match
    anymore. */
export function AlignmentPlaybackPreview() {
  const videoElementRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachPlaybackVideoElement(videoElementRef.current);
    return () => attachPlaybackVideoElement(null);
  }, []);

  const isPlaying = isPlaybackPlaying.value;
  const videoSrc = previewVideoObjectUrl.value;

  const handleTogglePlayback = () => {
    if (isPlaying) {
      pausePreview();
    } else {
      playPreview();
    }
  };

  const handleRestart = () => {
    seekPreview(0);
    playPreview(0);
  };

  return (
    <Card>
      <SectionHeading title="Preview" description="Plays the first matched pair — drag the offset until the audio lines up with the picture." />
      <video
        ref={videoElementRef}
        src={videoSrc ?? undefined}
        class="mx-auto mt-4 block max-h-[420px] w-auto max-w-full rounded-lg border border-border-subtle bg-black"
        playsInline
        muted
      />

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={handleRestart}>
          ⏮ Restart
        </Button>
        <Button variant={isPlaying ? 'primary' : 'secondary'} onClick={handleTogglePlayback}>
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <span class="ml-auto font-mono text-xs tabular-nums text-text-secondary">{formatDurationClock(playbackCurrentTimeSeconds.value)}</span>
      </div>

      <div class="mt-5">
        <RangeControl
          label="Offset"
          value={offsetSeconds.value}
          min={-OFFSET_RANGE_SECONDS}
          max={OFFSET_RANGE_SECONDS}
          step={0.01}
          unit="s"
          onChange={updateOffsetSeconds}
        />
      </div>
    </Card>
  );
}
