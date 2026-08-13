import type { ComponentChildren, JSX } from 'preact';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  children: ComponentChildren;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: JSX.CSSProperties;
}

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-surface-base shadow-[0_10px_24px_-12px_var(--color-accent)] hover:bg-accent-strong hover:-translate-y-px hover:shadow-[0_14px_28px_-12px_var(--color-accent)]',
  secondary: 'bg-surface-overlay text-text-primary border border-border-strong hover:border-accent/60 hover:-translate-y-px',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay',
};

export function Button({ children, onClick, variant = 'secondary', disabled = false, type = 'button', style }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      class={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium tracking-wide transition-all duration-200 ease-out disabled:pointer-events-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none active:scale-[0.97] ${VARIANT_CLASS_NAMES[variant]}`}
    >
      {children}
    </button>
  );
}
