import type { ComponentChildren } from 'preact';

interface TrustPillProps {
  label: string;
}

function TrustPill({ label }: TrustPillProps) {
  return (
    <span class="flex items-center gap-1.5">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5 text-accent">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4 10 4 4 8-8" />
      </svg>
      {label}
    </span>
  );
}

function FloatingBadge({ class: className, rotation, children }: { class: string; rotation: number; children: ComponentChildren }) {
  return (
    <span
      class={`absolute hidden h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised text-accent shadow-lg md:flex ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </span>
  );
}

export function Hero() {
  return (
    <section class="relative mx-auto mt-6 max-w-2xl px-6 pb-12 pt-14 text-center">
      <FloatingBadge class="-left-2 top-2" rotation={-8}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
          <path stroke-linecap="round" d="M3 12h2l2-7 3 14 3-11 2 4h6" />
        </svg>
      </FloatingBadge>
      <FloatingBadge class="-right-2 top-8" rotation={7}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
          <circle cx="12" cy="12" r="8" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2" />
        </svg>
      </FloatingBadge>

      <h1 class="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
        Remove silence,
        <span class="block font-serif text-3xl font-normal italic text-accent sm:text-4xl [text-shadow:0_4px_14px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]">
          your way.
        </span>
      </h1>

      <p class="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-text-secondary sm:text-base">
        Short, medium, and long pauses are detected automatically, then each one is yours to fine-tune — threshold,
        cut length, everything. It all runs right here in your browser.
      </p>

      <div class="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-secondary">
        <TrustPill label="Three-tier precision" />
        <TrustPill label="Auto-detected defaults" />
        <TrustPill label="100% local" />
      </div>
    </section>
  );
}
