const FADE_UP_STAGGER_STEP_MILLISECONDS = 70;
const FADE_UP_DURATION_MILLISECONDS = 480;

/** A CSS `style` string that fades and slides an element in once, staggered by its position in a sequence. */
export function fadeUpEntranceStyle(sequenceIndex: number): string {
  return `animation: fade-up ${FADE_UP_DURATION_MILLISECONDS}ms cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: ${
    sequenceIndex * FADE_UP_STAGGER_STEP_MILLISECONDS
  }ms;`;
}
