import { clampNumber } from '../utils/clampNumber';

export function trimAudioChannels(
  channelData: Float32Array<ArrayBuffer>[],
  sampleRate: number,
  startTrimSeconds: number,
  endTrimSeconds: number,
): Float32Array<ArrayBuffer>[] {
  const numberOfFrames = channelData[0]?.length ?? 0;
  const startFrame = clampNumber(Math.round(startTrimSeconds * sampleRate), 0, numberOfFrames);
  const endFrame = clampNumber(numberOfFrames - Math.round(endTrimSeconds * sampleRate), startFrame, numberOfFrames);

  return channelData.map(channel => channel.slice(startFrame, endFrame));
}
