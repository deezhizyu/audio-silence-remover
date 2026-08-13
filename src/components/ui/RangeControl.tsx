import type { JSX } from 'preact';
import { clampNumber } from '../../utils/clampNumber';

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  accentColor?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RangeControl({ label, value, min, max, step, unit, accentColor, onChange, disabled = false }: RangeControlProps) {
  const decimalPlaces = step < 1 ? 2 : 0;
  const fillPercent = clampNumber(((value - min) / (max - min)) * 100, 0, 100);
  const fillColor = accentColor ?? 'var(--color-accent)';

  const handleInput = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange(Number(event.currentTarget.value));
  };

  return (
    <div class="group/control flex flex-col gap-2">
      <div class="flex items-center justify-between text-xs">
        <label class="font-medium text-text-secondary transition-colors duration-200 group-hover/control:text-text-primary">{label}</label>
        <span class="font-mono tabular-nums text-text-primary">
          {value.toFixed(decimalPlaces)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onInput={handleInput}
        class="range-slider"
        style={`--fill-color: ${fillColor}; --fill-percent: ${fillPercent}%;`}
      />
    </div>
  );
}
