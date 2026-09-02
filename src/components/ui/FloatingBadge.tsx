import type { ComponentChildren } from 'preact';

interface FloatingBadgeProps {
  class: string;
  rotation: number;
  children: ComponentChildren;
}

export function FloatingBadge({ class: className, rotation, children }: FloatingBadgeProps) {
  return (
    <span
      class={`absolute hidden h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised text-accent shadow-lg md:flex ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </span>
  );
}
