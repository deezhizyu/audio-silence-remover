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
      <SectionHeading title="Alignment preview" description="The sync offset is detected by matching the two files' waveform transients, not by the threshold below." />
      <div class="mt-4 flex flex-col gap-2">
        <MetricRow label="Original leading silence (below threshold)" value={formatSecondsLabel(metrics.originalLeadingSilenceSeconds)} />
        <MetricRow label="Voice-changed leading silence (below threshold)" value={formatSecondsLabel(metrics.voiceChangedLeadingSilenceSeconds)} />
        <MetricRow label="Trimmed from start (detected sync offset)" value={formatSecondsLabel(metrics.startTrimSeconds)} />
        <MetricRow label="Trimmed from end (to match original duration)" value={formatSecondsLabel(metrics.endTrimSeconds)} />
        <MetricRow
          label="Resulting duration / original"
          value={`${formatSecondsLabel(metrics.resultingDurationSeconds)} / ${formatSecondsLabel(metrics.originalAudioDurationSeconds)}`}
        />
      </div>
    </Card>
  );
}
