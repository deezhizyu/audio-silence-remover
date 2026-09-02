import { useState } from 'preact/hooks';
import { computeZoomWindowSeconds } from '../audio/computeZoomWindowSeconds';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { offsetSeconds, playbackCurrentTimeSeconds, seekPreview, setZoomCenterSeconds, zoomCenterSeconds } from '../state/audioAlignmentSignals';
import { AlignmentSourceWaveform } from './AlignmentSourceWaveform';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { SectionHeading } from './ui/SectionHeading';

interface AlignmentWaveformsProps {
  originalVideoEnvelope: SerializedAmplitudeEnvelope;
  voiceChangedAudioEnvelope: SerializedAmplitudeEnvelope;
}

const ZOOM_WINDOW_SECONDS = 0.15;

/** Waveforms for the reference (first matched) pair only — batch export applies the same offset to
    every other pair without a per-pair waveform check. */
export function AlignmentWaveforms({ originalVideoEnvelope, voiceChangedAudioEnvelope }: AlignmentWaveformsProps) {
  const zoomCenter = zoomCenterSeconds.value;
  const isZoomed = zoomCenter !== null;

  // True for the whole span of an edge-pan drag (started by either waveform, since they share the same
  // zoom center) — suspends both waveforms' eased zoom-transition animation so panning snaps instantly
  // instead of racing a 250ms tween on every tick.
  const [isDragActive, setIsDragActive] = useState(false);

  // The original waveform's window is the shared, canonical one (its own timeline *is* the shared
  // timeline); the voice-changed waveform's window is the exact same span shifted by the offset,
  // unclamped — so dragging the offset slider visibly slides its content within the fixed window the
  // user is looking at, including past the edge into a silent, un-clamped padding region.
  const sharedWindow = isZoomed
    ? computeZoomWindowSeconds(zoomCenter, ZOOM_WINDOW_SECONDS, originalVideoEnvelope.durationSeconds)
    : { startSeconds: 0, endSeconds: originalVideoEnvelope.durationSeconds };
  const voiceChangedWindow = {
    startSeconds: sharedWindow.startSeconds + offsetSeconds.value,
    endSeconds: sharedWindow.endSeconds + offsetSeconds.value,
  };

  const sharedPlayheadSeconds = playbackCurrentTimeSeconds.value;
  const voiceChangedPlayheadSeconds = sharedPlayheadSeconds + offsetSeconds.value;

  // A pan's delta is timeline-agnostic — shifting the shared center by the same amount shifts both
  // waveforms' windows identically, so one handler covers drags started on either waveform.
  const handlePan = (deltaSeconds: number) => {
    const currentCenter = zoomCenter ?? sharedPlayheadSeconds;
    setIsDragActive(true);
    setZoomCenterSeconds(currentCenter + deltaSeconds);
  };

  const handleOriginalSeek = (seconds: number) => {
    seekPreview(seconds);
  };

  const handleOriginalSeekEnd = (seconds: number) => {
    setIsDragActive(false);
    setZoomCenterSeconds(seconds);
    seekPreview(seconds);
  };

  const handleVoiceChangedSeek = (voiceChangedSeconds: number) => {
    seekPreview(voiceChangedSeconds - offsetSeconds.value);
  };

  const handleVoiceChangedSeekEnd = (voiceChangedSeconds: number) => {
    const sharedSeconds = voiceChangedSeconds - offsetSeconds.value;
    setIsDragActive(false);
    setZoomCenterSeconds(sharedSeconds);
    seekPreview(sharedSeconds);
  };

  return (
    <Card>
      <div class="flex items-start justify-between gap-3">
        <SectionHeading title="Waveforms" description="Click or drag across either waveform to zoom in and line them up by ear and eye." />
        {isZoomed && (
          <Button variant="ghost" onClick={() => setZoomCenterSeconds(null)}>
            Zoom out
          </Button>
        )}
      </div>
      <div class="mt-4 flex flex-col gap-4">
        <AlignmentSourceWaveform
          label="Original video audio"
          envelope={originalVideoEnvelope}
          windowStartSeconds={sharedWindow.startSeconds}
          windowEndSeconds={sharedWindow.endSeconds}
          highlightRegions={[]}
          playheadSeconds={sharedPlayheadSeconds}
          onSeek={handleOriginalSeek}
          onPan={handlePan}
          onSeekEnd={handleOriginalSeekEnd}
          skipZoomAnimation={isDragActive}
        />
        <AlignmentSourceWaveform
          label="Voice-changed audio"
          envelope={voiceChangedAudioEnvelope}
          windowStartSeconds={voiceChangedWindow.startSeconds}
          windowEndSeconds={voiceChangedWindow.endSeconds}
          highlightRegions={[]}
          playheadSeconds={voiceChangedPlayheadSeconds}
          onSeek={handleVoiceChangedSeek}
          onPan={handlePan}
          onSeekEnd={handleVoiceChangedSeekEnd}
          skipZoomAnimation={isDragActive}
        />
      </div>
    </Card>
  );
}
