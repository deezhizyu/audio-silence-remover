import type { AlignmentMetrics } from '../state/audioAlignmentSignals';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { AlignmentSourceWaveform } from './AlignmentSourceWaveform';
import { Card } from './ui/Card';
import { SectionHeading } from './ui/SectionHeading';
import type { WaveformHighlightRegion } from './waveformDrawing';

interface AlignmentWaveformsProps {
  originalVideoEnvelope: SerializedAmplitudeEnvelope;
  voiceChangedAudioEnvelope: SerializedAmplitudeEnvelope;
  metrics: AlignmentMetrics | null;
}

/** Canvas 2D's `fillStyle` can't resolve `var(...)` references the way DOM element styles can — colors
    handed to the drawing function must already be concrete, resolved via `getComputedStyle`. These are
    root-level theme tokens (see `index.css`), so resolving against `documentElement` works everywhere,
    the same as `Waveform.tsx`'s own `resolveThemeColors` does per-instance for its category colors. */
function resolveCssColor(variableName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

export function AlignmentWaveforms({ originalVideoEnvelope, voiceChangedAudioEnvelope, metrics }: AlignmentWaveformsProps) {
  const silenceHighlightColor = resolveCssColor('--color-silence-medium');
  const trimHighlightColor = resolveCssColor('--color-danger');

  const originalHighlights: WaveformHighlightRegion[] = metrics
    ? [{ startSeconds: 0, endSeconds: metrics.originalLeadingSilenceSeconds, color: silenceHighlightColor }]
    : [];

  // Silence drawn before trim: `startTrimSeconds` is always <= the detected leading silence, so the trim
  // highlight lands fully inside the silence one — drawing trim on top leaves a visible grey remainder
  // wherever detected silence extends past what's actually being cut.
  const voiceChangedHighlights: WaveformHighlightRegion[] = metrics
    ? [
        { startSeconds: 0, endSeconds: metrics.voiceChangedLeadingSilenceSeconds, color: silenceHighlightColor },
        { startSeconds: 0, endSeconds: metrics.startTrimSeconds, color: trimHighlightColor },
        {
          startSeconds: voiceChangedAudioEnvelope.durationSeconds - metrics.endTrimSeconds,
          endSeconds: voiceChangedAudioEnvelope.durationSeconds,
          color: trimHighlightColor,
        },
      ]
    : [];

  return (
    <Card>
      <SectionHeading
        title="Waveforms"
        description="Purple marks audio below the silence threshold; red marks what export will actually trim from the voice-changed audio — these can differ, since trimming is based on matching the two signals, not the threshold."
      />
      <div class="mt-4 flex flex-col gap-4">
        <AlignmentSourceWaveform label="Original video audio" envelope={originalVideoEnvelope} highlightRegions={originalHighlights} />
        <AlignmentSourceWaveform label="Voice-changed audio" envelope={voiceChangedAudioEnvelope} highlightRegions={voiceChangedHighlights} />
      </div>
    </Card>
  );
}
