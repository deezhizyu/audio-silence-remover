import { clampNumber } from '../utils/clampNumber';

/**
 * Shifts every channel's start by `startShiftSeconds` and trims `endTrimSeconds` off the end.
 * `startShiftSeconds` is signed: `>= 0` trims that much off the front (the audio starts later);
 * `< 0` prepends `-startShiftSeconds` seconds of zero-fill silence instead (the audio needs to
 * start even later than it currently does — e.g. aligning it against a source with more lead-in).
 * `endTrimSeconds` only ever trims. Doesn't mutate the input channels.
 */
export function shiftAndTrimAudioChannels(
  channelData: Float32Array<ArrayBuffer>[],
  sampleRate: number,
  startShiftSeconds: number,
  endTrimSeconds: number,
): Float32Array<ArrayBuffer>[] {
  const numberOfFrames = channelData[0]?.length ?? 0;
  const startShiftFrames = Math.round(startShiftSeconds * sampleRate);
  const endTrimFrames = Math.max(0, Math.round(endTrimSeconds * sampleRate));

  if (startShiftFrames >= 0) {
    const startFrame = clampNumber(startShiftFrames, 0, numberOfFrames);
    const endFrame = clampNumber(numberOfFrames - endTrimFrames, startFrame, numberOfFrames);
    return channelData.map(channel => channel.slice(startFrame, endFrame));
  }

  const paddingFrames = -startShiftFrames;
  const endFrame = clampNumber(numberOfFrames - endTrimFrames, 0, numberOfFrames);
  return channelData.map(channel => {
    const padded = new Float32Array(paddingFrames + endFrame);
    padded.set(channel.subarray(0, endFrame), paddingFrames);
    return padded;
  });
}
