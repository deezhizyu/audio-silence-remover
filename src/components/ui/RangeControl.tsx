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
  /** Adjust the value by exactly one `step` per wheel tick while hovered, rather than relying on the
      browser's own (inconsistent, and often absent) wheel handling for range inputs — useful for a
      slider whose drag resolution, limited by its on-screen width, is coarser than its step. Off by
      default so existing sliders don't start reacting to an incidental page-scroll wheel event over them. */
  enableWheelStep?: boolean;
}

/** The number of digits after the decimal point in `step`'s own literal representation (e.g. `0.001` ->
    3) — so the displayed value's precision always matches what the slider can actually produce, rather
    than a fixed guess that's wrong for a step finer than hundredths. */
function countDecimalPlaces(step: number): number {
  const stepString = step.toString();
  const decimalIndex = stepString.indexOf('.');
  return decimalIndex === -1 ? 0 : stepString.length - decimalIndex - 1;
}

export function RangeControl({ label, value, min, max, step, unit, accentColor, onChange, disabled = false, enableWheelStep = false }: RangeControlProps) {
  const decimalPlaces = countDecimalPlaces(step);
  const fillPercent = clampNumber(((value - min) / (max - min)) * 100, 0, 100);
  const fillColor = accentColor ?? 'var(--color-accent)';

  const handleInput = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange(Number(event.currentTarget.value));
  };

  // Rounded to the step's own precision (rather than left as raw floating-point addition) so repeated
  // scrolling can't drift off the step grid the way e.g. 0.1 + 0.2 would.
  const handleWheel = (event: JSX.TargetedWheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextValue = clampNumber(Number((value + direction * step).toFixed(decimalPlaces)), min, max);
    onChange(nextValue);
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
        onWheel={enableWheelStep ? handleWheel : undefined}
        class="range-slider"
        style={`--fill-color: ${fillColor}; --fill-percent: ${fillPercent}%;`}
      />
    </div>
  );
}
