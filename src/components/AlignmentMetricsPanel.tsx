import type { AlignmentMetrics } from '../state/audioAlignmentSignals';
import { formatSecondsLabel } from '../utils/formatNumbers';
import { Card } from './ui/Card';
import { SectionHeading } from './ui/SectionHeading';

interface AlignmentMetricsPanelProps {
  metrics: AlignmentMetrics | null;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div class="flex items-center justify-between text-xs">
      <span class="text-text-secondary">{label}</span>
      <span class="font-mono tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

export function AlignmentMetricsPanel({ metrics }: AlignmentMetricsPanelProps) {
  if (!metrics) {
    return (
      <Card>
        <SectionHeading title="Alignment preview" description="Upload both files to see the detected padding and trim." />
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeading title="Alignment preview" description="Recalculated live as you adjust the threshold." />
      <div class="mt-4 flex flex-col gap-2">
        <MetricRow label="Original leading silence" value={formatSecondsLabel(metrics.originalLeadingSilenceSeconds)} />
        <MetricRow label="Voice-changed leading silence" value={formatSecondsLabel(metrics.voiceChangedLeadingSilenceSeconds)} />
        <MetricRow label="Trimmed from start" value={formatSecondsLabel(metrics.startTrimSeconds)} />
        <MetricRow label="Trimmed from end" value={formatSecondsLabel(metrics.endTrimSeconds)} />
        <MetricRow
          label="Resulting duration / original"
          value={`${formatSecondsLabel(metrics.resultingDurationSeconds)} / ${formatSecondsLabel(metrics.originalAudioDurationSeconds)}`}
        />
      </div>
    </Card>
  );
}
