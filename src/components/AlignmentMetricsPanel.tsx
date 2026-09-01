import { formatSecondsLabel } from '../utils/formatNumbers';
import { Card } from './ui/Card';
import { SectionHeading } from './ui/SectionHeading';

interface AlignmentMetricsPanelProps {
  offsetSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  originalAudioDurationSeconds: number;
  voiceChangedAudioDurationSeconds: number;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div class="flex items-center justify-between text-xs">
      <span class="text-text-secondary">{label}</span>
      <span class="font-mono tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

/** Purely derived arithmetic from the three slider values — nothing here is computed by the app on the
    user's behalf, it's just a readable summary of what those sliders currently add up to. */
export function AlignmentMetricsPanel({
  offsetSeconds,
  trimStartSeconds,
  trimEndSeconds,
  originalAudioDurationSeconds,
  voiceChangedAudioDurationSeconds,
}: AlignmentMetricsPanelProps) {
  const netStartShiftSeconds = offsetSeconds + trimStartSeconds;
  const resultingDurationSeconds = Math.max(0, voiceChangedAudioDurationSeconds - Math.max(0, netStartShiftSeconds) - trimEndSeconds);

  return (
    <Card>
      <SectionHeading title="Result" description="What the current offset and trims add up to." />
      <div class="mt-4 flex flex-col gap-2">
        <MetricRow
          label={netStartShiftSeconds >= 0 ? 'Trimmed from start' : 'Silence inserted at start'}
          value={formatSecondsLabel(Math.abs(netStartShiftSeconds))}
        />
        <MetricRow label="Trimmed from end" value={formatSecondsLabel(trimEndSeconds)} />
        <MetricRow
          label="Resulting duration / original"
          value={`${formatSecondsLabel(resultingDurationSeconds)} / ${formatSecondsLabel(originalAudioDurationSeconds)}`}
        />
      </div>
    </Card>
  );
}
