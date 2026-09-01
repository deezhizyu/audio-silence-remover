const MAXIMUM_ENVELOPE_SAMPLE_COUNT = 200_000;
const MINIMUM_WINDOW_SECONDS = 0.001;

/**
 * The alignment page's waveforms are interactively zoomed down to a ~3-second window, so the envelope
 * needs far finer detail than the default 10ms window gives (that resolution was tuned for the
 * silence-remover's always-zoomed-out view). Sizing the window directly off the clip's own duration —
 * rather than a fixed constant — keeps a short dialogue clip crisp under zoom while capping the sample
 * count for a long video, so the array stays cheap to hold and transfer either way.
 */
export function chooseAlignmentEnvelopeWindowSeconds(durationSeconds: number): number {
  return Math.max(MINIMUM_WINDOW_SECONDS, durationSeconds / MAXIMUM_ENVELOPE_SAMPLE_COUNT);
}
