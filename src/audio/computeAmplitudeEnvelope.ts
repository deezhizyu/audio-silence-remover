import { clampNumber } from '../utils/clampNumber';

export interface AmplitudeEnvelope {
  /** RMS amplitude per window, across all channels. */
  rootMeanSquarePerWindow: Float32Array<ArrayBuffer>;
  windowSizeSeconds: number;
  /** A robust "how loud does this file get" reference; volume thresholds are expressed relative to this. */
  peakAmplitude: number;
  durationSeconds: number;
}

const ENVELOPE_WINDOW_SECONDS = 0.01;
/**
 * The reference used to normalize the volume threshold is the RMS envelope's own value at this percentile,
 * not the file's single loudest sample. A single transient (a click, a plosive, a clipped peak) would otherwise
 * inflate the true sample peak and push the effective silence threshold high enough to misclassify normal-volume
 * audio elsewhere in the file as silence.
 */
const REFERENCE_AMPLITUDE_PERCENTILE = 0.95;

export function computeAmplitudeEnvelope(channelData: Float32Array<ArrayBuffer>[], sampleRate: number): AmplitudeEnvelope {
  const windowSizeInFrames = Math.max(1, Math.round(ENVELOPE_WINDOW_SECONDS * sampleRate));
  const numberOfChannels = channelData.length;
  const numberOfFrames = channelData[0]?.length ?? 0;
  const numberOfWindows = Math.max(1, Math.ceil(numberOfFrames / windowSizeInFrames));

  const rootMeanSquarePerWindow = new Float32Array(numberOfWindows);

  for (let windowIndex = 0; windowIndex < numberOfWindows; windowIndex++) {
    const windowStartFrame = windowIndex * windowSizeInFrames;
    const windowEndFrame = Math.min(windowStartFrame + windowSizeInFrames, numberOfFrames);

    let sumOfSquares = 0;
    let sampleCount = 0;

    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
      const channel = channelData[channelIndex];
      for (let frame = windowStartFrame; frame < windowEndFrame; frame++) {
        const sampleValue = channel[frame];
        sumOfSquares += sampleValue * sampleValue;
        sampleCount += 1;
      }
    }

    rootMeanSquarePerWindow[windowIndex] = sampleCount > 0 ? Math.sqrt(sumOfSquares / sampleCount) : 0;
  }

  const sortedRootMeanSquareValues = Float32Array.from(rootMeanSquarePerWindow).sort();
  const referenceIndex = clampNumber(
    Math.floor(REFERENCE_AMPLITUDE_PERCENTILE * sortedRootMeanSquareValues.length),
    0,
    sortedRootMeanSquareValues.length - 1,
  );
  const peakAmplitude = sortedRootMeanSquareValues[referenceIndex];

  return {
    rootMeanSquarePerWindow,
    windowSizeSeconds: windowSizeInFrames / sampleRate,
    peakAmplitude: peakAmplitude > 0 ? peakAmplitude : 1,
    durationSeconds: numberOfFrames / sampleRate,
  };
}
