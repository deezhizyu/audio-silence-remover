interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      class="flex w-full items-center justify-between gap-3 text-left disabled:pointer-events-none disabled:opacity-50"
    >
      <span class="text-xs font-medium text-text-secondary">{label}</span>
      <span class={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-surface-overlay'}`}>
        <span
          class={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface-base shadow transition-transform duration-200 ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}
