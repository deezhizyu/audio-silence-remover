import { Card } from './ui/Card';
import { RangeControl } from './ui/RangeControl';
import { SectionHeading } from './ui/SectionHeading';

interface GlobalControlsProps {
  volumeThresholdPercent: number;
  onVolumeThresholdChange: (percent: number) => void;
}

export function GlobalControls({ volumeThresholdPercent, onVolumeThresholdChange }: GlobalControlsProps) {
  return (
    <Card>
      <SectionHeading
        title="Silence volume"
        description="Audio quieter than this threshold of the file's peak volume counts as silence."
      />
      <div class="mt-4">
        <RangeControl
          label="Threshold"
          value={volumeThresholdPercent}
          min={1}
          max={50}
          step={1}
          unit="%"
          onChange={onVolumeThresholdChange}
        />
      </div>
    </Card>
  );
}
