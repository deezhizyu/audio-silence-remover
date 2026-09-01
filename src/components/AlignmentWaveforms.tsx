import { computeZoomWindowSeconds } from '../audio/computeZoomWindowSeconds';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import {
  offsetSeconds,
  playbackCurrentTimeSeconds,
  seekPlayback,
  setZoomCenterSeconds,
  trimEndSeconds,
  trimStartSeconds,
  zoomCenterSeconds,
} from '../state/audioAlignmentSignals';
import { AlignmentSourceWaveform } from './AlignmentSourceWaveform';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { SectionHeading } from './ui/SectionHeading';
import type { WaveformHighlightRegion } from './waveformDrawing';

interface AlignmentWaveformsProps {
  originalVideoEnvelope: SerializedAmplitudeEnvelope;
  voiceChangedAudioEnvelope: SerializedAmplitudeEnvelope;
}

const ZOOM_WINDOW_SECONDS = 3;

/** Canvas 2D's `fillStyle` can't resolve `var(...)` references the way DOM element styles can — colors
    handed to the drawing function must already be concrete, resolved via `getComputedStyle`. */
function resolveCssColor(variableName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

export function AlignmentWaveforms({ originalVideoEnvelope, voiceChangedAudioEnvelope }: AlignmentWaveformsProps) {
  const zoomCenter = zoomCenterSeconds.value;
  const isZoomed = zoomCenter !== null;
  const netStartShiftSeconds = offsetSeconds.value + trimStartSeconds.value;

  // The original waveform's window is the shared, canonical one (its own timeline *is* the shared
  // timeline); the voice-changed waveform's window is the exact same span shifted by the net start
  // shift, unclamped — so dragging the offset slider visibly slides its content within the fixed window
  // the user is looking at, including past the edge into a silent, un-clamped padding region.
  const sharedWindow = isZoomed
    ? computeZoomWindowSeconds(zoomCenter, ZOOM_WINDOW_SECONDS, originalVideoEnvelope.durationSeconds)
    : { startSeconds: 0, endSeconds: originalVideoEnvelope.durationSeconds };
  const voiceChangedWindow = {
    startSeconds: sharedWindow.startSeconds + netStartShiftSeconds,
    endSeconds: sharedWindow.endSeconds + netStartShiftSeconds,
  };

  const trimHighlightColor = resolveCssColor('--color-danger');
  const voiceChangedHighlights: WaveformHighlightRegion[] = [];
  if (netStartShiftSeconds > 0) {
    voiceChangedHighlights.push({ startSeconds: 0, endSeconds: netStartShiftSeconds, color: trimHighlightColor });
  }
  if (trimEndSeconds.value > 0) {
    voiceChangedHighlights.push({
      startSeconds: voiceChangedAudioEnvelope.durationSeconds - trimEndSeconds.value,
      endSeconds: voiceChangedAudioEnvelope.durationSeconds,
      color: trimHighlightColor,
    });
  }

  const sharedPlayheadSeconds = playbackCurrentTimeSeconds.value;
  const voiceChangedPlayheadSeconds = sharedPlayheadSeconds + netStartShiftSeconds;

  const handleOriginalSeek = (seconds: number) => {
    setZoomCenterSeconds(seconds);
    seekPlayback(seconds);
  };

  const handleVoiceChangedSeek = (voiceChangedSeconds: number) => {
    const sharedSeconds = voiceChangedSeconds - netStartShiftSeconds;
    setZoomCenterSeconds(sharedSeconds);
    seekPlayback(sharedSeconds);
  };

  return (
    <Card>
      <div class="flex items-start justify-between gap-3">
        <SectionHeading
          title="Waveforms"
          description="Click a point on either waveform to zoom in and line them up by ear and eye. Red marks what export will trim from the voice-changed audio."
        />
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
        />
        <AlignmentSourceWaveform
          label="Voice-changed audio"
          envelope={voiceChangedAudioEnvelope}
          windowStartSeconds={voiceChangedWindow.startSeconds}
          windowEndSeconds={voiceChangedWindow.endSeconds}
          highlightRegions={voiceChangedHighlights}
          playheadSeconds={voiceChangedPlayheadSeconds}
          onSeek={handleVoiceChangedSeek}
        />
      </div>
    </Card>
  );
}
