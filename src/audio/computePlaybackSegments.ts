import { planSilenceCuts } from './planSilenceCuts';
import type { DetectionConfig, SilenceRegion } from './types';

export interface PlaybackSegment {
  originalStartSeconds: number;
  originalEndSeconds: number;
}

/**
 * The ordered list of time ranges (in the original, undecoded timeline) that a faithful preview should
 * actually play. Derived from the exact same cut boundaries the final export uses, so scrubbing through a
 * preview skips precisely the audio that downloading would remove — never more, never less.
 */
export function computePlaybackSegments(
  durationSeconds: number,
  sampleRate: number,
  regions: SilenceRegion[],
  config: DetectionConfig,
): PlaybackSegment[] {
  const totalFrames = Math.round(durationSeconds * sampleRate);
  const cuts = planSilenceCuts(regions, config, sampleRate, totalFrames);

  const segments: PlaybackSegment[] = [];
  let cursorFrame = 0;

  for (const cut of cuts) {
    if (cut.removeStartFrame > cursorFrame) {
      segments.push({ originalStartSeconds: cursorFrame / sampleRate, originalEndSeconds: cut.removeStartFrame / sampleRate });
    }
    cursorFrame = cut.removeEndFrame;
  }

  if (cursorFrame < totalFrames) {
    segments.push({ originalStartSeconds: cursorFrame / sampleRate, originalEndSeconds: totalFrames / sampleRate });
  }

  return segments;
}
