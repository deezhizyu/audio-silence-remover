export interface AlignmentTrimInput {
  /** The raw, unclamped sync offset (e.g. from `computeCrossCorrelationOffsetSeconds`) — how far into
      the voice-changed audio its content actually starts matching the original. Can be negative. */
  startTrimSeconds: number;
  originalAudioDurationSeconds: number;
  voiceChangedDurationSeconds: number;
}

export interface AlignmentTrim {
  startTrimSeconds: number;
  endTrimSeconds: number;
}

/**
 * Only ever cuts, never pads: a negative `startTrimSeconds` (the voice-changed audio's matching content
 * starts before the original's) clamps to 0 rather than going negative. "Original audio duration" means
 * the original video's audio track duration, not the video container's overall duration.
 */
export function computeAlignmentTrim({ startTrimSeconds, originalAudioDurationSeconds, voiceChangedDurationSeconds }: AlignmentTrimInput): AlignmentTrim {
  const clampedStartTrimSeconds = Math.max(0, startTrimSeconds);
  const remainingDurationAfterStartTrim = voiceChangedDurationSeconds - clampedStartTrimSeconds;
  const endTrimSeconds = Math.max(0, remainingDurationAfterStartTrim - originalAudioDurationSeconds);

  return { startTrimSeconds: clampedStartTrimSeconds, endTrimSeconds };
}
