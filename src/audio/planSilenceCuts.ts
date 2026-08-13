import type { DetectionConfig, SilenceRegion } from './types';

export const CROSSFADE_DURATION_SECONDS = 0.012;

export interface PlannedCut {
  /** First frame removed from the source (start of the crossfade-out window). */
  removeStartFrame: number;
  /** First frame kept again after the cut (end of the crossfade-in window), exclusive. */
  removeEndFrame: number;
}

/**
 * For each region longer than its category's replaced length, decides which frame range to actually remove:
 * a slice of original audio equal to half the replaced length is kept at the head and tail of the region
 * (preserving natural room tone) and the middle is dropped. Regions too close to the start/end of the file
 * to fit a full crossfade are left untouched rather than risking an audible splice.
 *
 * Shared by the export cut/encode path and the live-preview playback engine, so what you hear in the
 * preview always matches exactly what the downloaded file will contain.
 */
export function planSilenceCuts(
  regions: SilenceRegion[],
  config: DetectionConfig,
  sampleRate: number,
  totalFrames: number,
  crossfadeFrames: number = Math.round(CROSSFADE_DURATION_SECONDS * sampleRate),
): PlannedCut[] {
  const cuts: PlannedCut[] = [];

  for (const region of regions) {
    const replacedLengthSeconds = config[region.category].replacedLengthSeconds;
    const regionStartFrame = Math.round(region.startSeconds * sampleRate);
    const regionEndFrame = Math.round(region.endSeconds * sampleRate);
    const keptFrames = Math.round(replacedLengthSeconds * sampleRate);

    if (regionEndFrame - regionStartFrame <= keptFrames) continue;

    const keptHeadFrames = Math.floor(keptFrames / 2);
    const keptTailFrames = keptFrames - keptHeadFrames;
    const removeStartFrame = regionStartFrame + keptHeadFrames;
    const removeEndFrame = regionEndFrame - keptTailFrames;

    const hasRoomForCrossfade = removeEndFrame - removeStartFrame >= crossfadeFrames
      && removeStartFrame - crossfadeFrames >= 0
      && removeEndFrame + crossfadeFrames <= totalFrames;
    if (!hasRoomForCrossfade) continue;

    cuts.push({ removeStartFrame, removeEndFrame });
  }

  return cuts;
}
