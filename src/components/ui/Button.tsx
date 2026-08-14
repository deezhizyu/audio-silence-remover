import type { ComponentChildren } from 'preact';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-surface-base shadow-[0_6px_16px_-12px_color-mix(in_srgb,var(--color-accent)_45%,transparent)] hover:bg-accent-strong hover:-translate-y-px',
  secondary: 'bg-surface-overlay text-text-primary border border-border-strong hover:border-accent/60 hover:-translate-y-px',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay',
};

export function Button({ children, onClick, variant = 'secondary', disabled = false, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      class={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium tracking-wide transition-all duration-200 ease-out disabled:pointer-events-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none active:scale-[0.97] ${VARIANT_CLASS_NAMES[variant]}`}
    >
      {children}
    </button>
  );
}
