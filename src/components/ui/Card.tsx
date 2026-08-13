import type { ComponentChildren } from 'preact';

interface CardProps {
  children: ComponentChildren;
  class?: string;
  style?: string;
  /** Set false when the caller's own CSS class owns the border color (e.g. for a color that changes on hover) —
      a Tailwind color utility here would otherwise always win over it, since utilities are layered after components. */
  coloredBorder?: boolean;
}

export function Card({ children, class: className = '', style, coloredBorder = true }: CardProps) {
  return (
    <div class={`rounded-lg border bg-surface-raised p-5 ${coloredBorder ? 'border-border-subtle' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}
