import { FloatingBadge } from './ui/FloatingBadge';
import { TrustPill } from './ui/TrustPill';

export function AlignmentHero() {
  return (
    <section class="relative mx-auto mt-6 max-w-2xl px-6 pb-8 pt-14 text-center">
      <FloatingBadge class="-left-2 top-2" rotation={-8}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h11M7 7l3-3M7 7l3 3M17 17H6m11 0-3-3m3 3-3 3" />
        </svg>
      </FloatingBadge>
      <FloatingBadge class="-right-2 top-8" rotation={7}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-5 w-5">
          <circle cx="12" cy="12" r="8" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2" />
        </svg>
      </FloatingBadge>

      <h1 class="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
        Align your audio,
        <span class="block font-serif text-3xl font-normal italic text-accent sm:text-4xl [text-shadow:0_4px_14px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]">
          back in sync.
        </span>
      </h1>

      <p class="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-text-secondary sm:text-base">
        Fix the padding an AI voice changer adds to your dialogue. Drop your original videos and their
        voice-changed audio together — tune one offset against a preview, then export with that offset
        applied to every pair.
      </p>

      <div class="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-secondary">
        <TrustPill label="Auto-paired files" />
        <TrustPill label="Live offset preview" />
        <TrustPill label="100% local" />
        <TrustPill label="Fully open-source" />
      </div>
    </section>
  );
}
