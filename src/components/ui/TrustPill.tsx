interface TrustPillProps {
  label: string;
}

export function TrustPill({ label }: TrustPillProps) {
  return (
    <span class="flex items-center gap-1.5">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5 text-accent">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4 10 4 4 8-8" />
      </svg>
      {label}
    </span>
  );
}
