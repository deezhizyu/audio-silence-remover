import { planSilenceCuts, CROSSFADE_DURATION_SECONDS } from './planSilenceCuts';
import type { DetectionConfig, SilenceRegion } from './types';

function equalPowerCrossfadeGains(progress: number): { fadeOutGain: number; fadeInGain: number } {
  const angle = progress * (Math.PI / 2);
  return { fadeOutGain: Math.cos(angle), fadeInGain: Math.sin(angle) };
}

export function cutSilenceRegions(
  channelData: Float32Array<ArrayBuffer>[],
  sampleRate: number,
  regions: SilenceRegion[],
  config: DetectionConfig,
): Float32Array<ArrayBuffer>[] {
  const numberOfChannels = channelData.length;
  const totalFrames = channelData[0]?.length ?? 0;
  const crossfadeFrames = Math.round(CROSSFADE_DURATION_SECONDS * sampleRate);

  const cuts = planSilenceCuts(regions, config, sampleRate, totalFrames, crossfadeFrames);
  if (cuts.length === 0) {
    return channelData.map(channel => Float32Array.from(channel));
  }

  const framesRemovedByCuts = cuts.reduce((total, cut) => total + (cut.removeEndFrame - cut.removeStartFrame - crossfadeFrames), 0);
  const outputChannels = Array.from({ length: numberOfChannels }, () => new Float32Array(totalFrames - framesRemovedByCuts));

  let readCursor = 0;
  let writeCursor = 0;

  for (const cut of cuts) {
    const crossfadeStartFrame = cut.removeStartFrame - crossfadeFrames;

    const verbatimFrameCount = crossfadeStartFrame - readCursor;
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
      outputChannels[channelIndex].set(channelData[channelIndex].subarray(readCursor, crossfadeStartFrame), writeCursor);
    }
    writeCursor += verbatimFrameCount;

    for (let step = 0; step < crossfadeFrames; step++) {
      const { fadeOutGain, fadeInGain } = equalPowerCrossfadeGains((step + 1) / crossfadeFrames);
      const fadeOutFrame = crossfadeStartFrame + step;
      const fadeInFrame = cut.removeEndFrame + step;

      for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
        const channel = channelData[channelIndex];
        outputChannels[channelIndex][writeCursor + step] = channel[fadeOutFrame] * fadeOutGain + channel[fadeInFrame] * fadeInGain;
      }
    }
    writeCursor += crossfadeFrames;

    readCursor = cut.removeEndFrame + crossfadeFrames;
  }

  const finalVerbatimFrameCount = totalFrames - readCursor;
  for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
    outputChannels[channelIndex].set(channelData[channelIndex].subarray(readCursor, totalFrames), writeCursor);
  }
  writeCursor += finalVerbatimFrameCount;

  return outputChannels;
}
