export type SilenceCategoryKey = 'short' | 'medium' | 'long';

export const SILENCE_CATEGORY_KEYS: readonly SilenceCategoryKey[] = ['short', 'medium', 'long'];

export interface SilenceCategoryConfig {
  /** Silence must last at least this long to be classified into this category, in seconds. */
  minLengthSeconds: number;
  /** A detected silence longer than this is shortened down to exactly this duration, in seconds. */
  replacedLengthSeconds: number;
  /** A sound shorter than this, sandwiched between two silences, is swallowed into the silence rather than breaking it up, in seconds. */
  audibleLengthSeconds: number;
}

export interface DetectionConfig {
  /** Amplitude below this percentage of the file's own peak volume is treated as silence. */
  volumeThresholdPercent: number;
  short: SilenceCategoryConfig;
  medium: SilenceCategoryConfig;
  long: SilenceCategoryConfig;
}

export interface SilenceRegion {
  category: SilenceCategoryKey;
  startSeconds: number;
  endSeconds: number;
}

export type ExportAudioFormat = 'wav' | 'mp3';

export interface DecodedAudioChannels {
  channelData: Float32Array<ArrayBuffer>[];
  sampleRate: number;
  numberOfFrames: number;
}
