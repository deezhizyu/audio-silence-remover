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

/** The number of digits after the decimal point in `step`'s own literal representation (e.g. `0.001` ->
    3) — so the displayed value's precision always matches what the slider can actually produce, rather
    than a fixed guess that's wrong for a step finer than hundredths. */
function countDecimalPlaces(step: number): number {
  const stepString = step.toString();
  const decimalIndex = stepString.indexOf('.');
  return decimalIndex === -1 ? 0 : stepString.length - decimalIndex - 1;
}

export function RangeControl({ label, value, min, max, step, unit, accentColor, onChange, disabled = false }: RangeControlProps) {
  const decimalPlaces = countDecimalPlaces(step);
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
