import { useEffect, useRef } from 'preact/hooks';
import { formatDurationClock } from '../utils/formatNumbers';
import {
  activePlaybackSource,
  attachPlaybackVideoElement,
  isPlaybackPlaying,
  offsetSeconds,
  pausePreview,
  playbackCurrentTimeSeconds,
  playOriginalAudio,
  playVoiceChangedAudio,
  seekPreview,
  updateOffsetSeconds,
} from '../state/audioAlignmentSignals';
import { AlignmentZoomableVideo } from './AlignmentZoomableVideo';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { RangeControl } from './ui/RangeControl';
import { SectionHeading } from './ui/SectionHeading';

const OFFSET_RANGE_SECONDS = 2;
const OFFSET_STEP_SECONDS = 0.001;

/** Previews the first matched pair: switch between the video's own native audio ("original") and the
    voice-changed audio scheduled with the current offset ("aligned") to compare the two by ear — only
    one is ever audible at a time. Sized to a sane, fixed width rather than stretched to match a sibling
    panel — there's nothing beside it to match anymore. */
export function AlignmentPlaybackPreview() {
  const videoElementRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachPlaybackVideoElement(videoElementRef.current);
    return () => attachPlaybackVideoElement(null);
  }, []);

  const activeSource = activePlaybackSource.value;
  const isPlaying = isPlaybackPlaying.value;

  const handleToggleOriginal = () => {
    if (activeSource === 'original' && isPlaying) {
      pausePreview();
    } else {
      playOriginalAudio();
    }
  };

  const handleToggleVoiceChanged = () => {
    if (activeSource === 'voiceChanged' && isPlaying) {
      pausePreview();
    } else {
      playVoiceChangedAudio();
    }
  };

  const handleRestart = () => {
    seekPreview(0);
    if (activeSource === 'voiceChanged') {
      playVoiceChangedAudio(0);
    } else {
      playOriginalAudio(0);
    }
  };

  return (
    <Card>
      <SectionHeading title="Preview" description="Plays the first matched pair — switch between original and aligned audio to compare, and drag the offset until they line up." />
      <div class="mt-4">
        <AlignmentZoomableVideo videoElementRef={videoElementRef} />
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={handleRestart}>
          <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
            <rect x="4" y="4" width="2" height="12" rx="1" />
            <path d="M16 4.6a1 1 0 0 0-1.53-.85l-7.7 4.9a1.5 1.5 0 0 0 0 2.5l7.7 4.9A1 1 0 0 0 16 15V4.6Z" />
          </svg>
          Restart
        </Button>
        <Button variant={activeSource === 'original' && isPlaying ? 'primary' : 'secondary'} onClick={handleToggleOriginal}>
          {activeSource === 'original' && isPlaying ? 'Pause' : 'Play'} original
        </Button>
        <Button variant={activeSource === 'voiceChanged' && isPlaying ? 'primary' : 'secondary'} onClick={handleToggleVoiceChanged}>
          {activeSource === 'voiceChanged' && isPlaying ? 'Pause' : 'Play'} aligned
        </Button>
        <span class="ml-auto font-mono text-xs tabular-nums text-text-secondary">{formatDurationClock(playbackCurrentTimeSeconds.value)}</span>
      </div>

      <div class="mt-5">
        <RangeControl
          label="Offset"
          value={offsetSeconds.value}
          min={-OFFSET_RANGE_SECONDS}
          max={OFFSET_RANGE_SECONDS}
          step={OFFSET_STEP_SECONDS}
          unit="s"
          onChange={updateOffsetSeconds}
          enableWheelStep
        />
      </div>
    </Card>
  );
}
