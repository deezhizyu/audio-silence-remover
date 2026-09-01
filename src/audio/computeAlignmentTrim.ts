export interface AlignmentTrimInput {
  originalLeadingSilenceSeconds: number;
  originalAudioDurationSeconds: number;
  voiceChangedLeadingSilenceSeconds: number;
  voiceChangedDurationSeconds: number;
}

export interface AlignmentTrim {
  startTrimSeconds: number;
  endTrimSeconds: number;
}

/**
 * Only ever cuts, never pads: if the voice-changed audio already has less leading silence than the
 * original, `startTrimSeconds` is 0 rather than going negative. "Original audio duration" means the
 * original video's audio track duration, not the video container's overall duration.
 */
export function computeAlignmentTrim({
  originalLeadingSilenceSeconds,
  originalAudioDurationSeconds,
  voiceChangedLeadingSilenceSeconds,
  voiceChangedDurationSeconds,
}: AlignmentTrimInput): AlignmentTrim {
  const startTrimSeconds = Math.max(0, voiceChangedLeadingSilenceSeconds - originalLeadingSilenceSeconds);
  const remainingDurationAfterStartTrim = voiceChangedDurationSeconds - startTrimSeconds;
  const endTrimSeconds = Math.max(0, remainingDurationAfterStartTrim - originalAudioDurationSeconds);

  return { startTrimSeconds, endTrimSeconds };
}
