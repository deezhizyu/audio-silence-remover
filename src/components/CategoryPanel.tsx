import type { SilenceCategoryConfig, SilenceCategoryKey } from '../audio/types';
import { Card } from './ui/Card';
import { RangeControl } from './ui/RangeControl';
import { resolveSilenceCategoryColor, SILENCE_CATEGORY_LABELS } from './silenceCategoryPresentation';

interface CategoryPanelProps {
  category: SilenceCategoryKey;
  config: SilenceCategoryConfig;
  onMinLengthChange: (seconds: number) => void;
  onReplacedLengthChange: (seconds: number) => void;
  onAudibleLengthChange: (seconds: number) => void;
}

const CATEGORY_GLYPH_GAP_PERCENT: Record<SilenceCategoryKey, number> = {
  short: 20,
  medium: 42,
  long: 68,
};

const CATEGORY_CAPTIONS: Record<SilenceCategoryKey, string> = {
  short: 'Micro-gaps and quick breaths',
  medium: 'Natural pauses between phrases',
  long: 'Extended dead air',
};

/** A small timeline glyph — audio, gap, audio — whose gap width scales with the category, so the icon
    itself communicates "short/medium/long" rather than relying on a generic dot or label alone. */
function DurationGlyph({ category, color }: { category: SilenceCategoryKey; color: string }) {
  const gapPercent = CATEGORY_GLYPH_GAP_PERCENT[category];
  const audioPercent = (100 - gapPercent) / 2;

  return (
    <div class="flex h-7 w-16 shrink-0 items-center gap-px rounded-md bg-surface-overlay p-1">
      <div class="h-full rounded-sm bg-text-tertiary/50" style={`width: ${audioPercent}%`} />
      <div class="h-full rounded-sm transition-[background-color] duration-300" style={`width: ${gapPercent}%; background-color: ${color}`} />
      <div class="h-full rounded-sm bg-text-tertiary/50" style={`width: ${audioPercent}%`} />
    </div>
  );
}

export function CategoryPanel({ category, config, onMinLengthChange, onReplacedLengthChange, onAudibleLengthChange }: CategoryPanelProps) {
  const accentColor = resolveSilenceCategoryColor(category);

  return (
    <Card class="category-panel" style={`--panel-accent: ${accentColor};`} coloredBorder={false}>
      <div class="flex items-center gap-3">
        <DurationGlyph category={category} color={accentColor} />
        <div>
          <h3 class="text-[0.95rem] font-semibold text-text-primary">{SILENCE_CATEGORY_LABELS[category]} pauses</h3>
          <p class="text-xs text-text-tertiary">{CATEGORY_CAPTIONS[category]}</p>
        </div>
      </div>

      <div class="mt-5 flex flex-col gap-4">
        <RangeControl
          label="Minimum length"
          value={config.minLengthSeconds}
          min={0.1}
          max={15}
          step={0.05}
          unit="s"
          accentColor={accentColor}
          onChange={onMinLengthChange}
        />
        <RangeControl
          label="Replaced with"
          value={config.replacedLengthSeconds}
          min={0}
          max={5}
          step={0.05}
          unit="s"
          accentColor={accentColor}
          onChange={onReplacedLengthChange}
        />
        <RangeControl
          label="Audible length"
          value={config.audibleLengthSeconds}
          min={0.05}
          max={3}
          step={0.05}
          unit="s"
          accentColor={accentColor}
          onChange={onAudibleLengthChange}
        />
      </div>
    </Card>
  );
}
