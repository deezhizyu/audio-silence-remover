export const EDGE_FADE_DURATION_SECONDS = 0.1;

/** Linear fade-in/out over the first/last `fadeDurationSeconds`, clamped so the two fade windows never
    overlap on a clip shorter than twice the fade duration. Doesn't mutate the input channels. */
export function applyEdgeFades(
  channelData: Float32Array<ArrayBuffer>[],
  sampleRate: number,
  fadeDurationSeconds: number = EDGE_FADE_DURATION_SECONDS,
): Float32Array<ArrayBuffer>[] {
  const numberOfFrames = channelData[0]?.length ?? 0;
  const fadeFrames = Math.min(Math.round(fadeDurationSeconds * sampleRate), Math.floor(numberOfFrames / 2));

  return channelData.map(channel => {
    const faded = Float32Array.from(channel);
    for (let frame = 0; frame < fadeFrames; frame++) {
      const gain = frame / fadeFrames;
      faded[frame] *= gain;
      faded[numberOfFrames - 1 - frame] *= gain;
    }
    return faded;
  });
}
