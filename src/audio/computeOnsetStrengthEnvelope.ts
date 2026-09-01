/**
 * A simple onset-detection function: the positive (rising) part of the frame-to-frame change in RMS
 * amplitude. Sustained background noise or hum has a roughly flat envelope and produces almost no
 * onset strength, while the attack of an actual sound — a word starting, a beat, any "loud waveform
 * beginning" — shows up as a sharp spike. Correlating this instead of the raw envelope focuses
 * alignment on matching those transients rather than on matching noise floors, which can differ
 * between an original recording and its (often denoised) voice-changed counterpart even when the
 * actual speech content is already perfectly in sync.
 */
export function computeOnsetStrengthEnvelope(rootMeanSquarePerWindow: Float32Array): Float32Array {
  const windowCount = rootMeanSquarePerWindow.length;
  const onsetStrength = new Float32Array(windowCount);

  for (let index = 1; index < windowCount; index++) {
    const rise = rootMeanSquarePerWindow[index] - rootMeanSquarePerWindow[index - 1];
    if (rise > 0) onsetStrength[index] = rise;
  }

  return onsetStrength;
}
