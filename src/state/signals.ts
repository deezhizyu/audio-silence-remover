import { signal } from '@preact/signals';
import { AudioAnalysisWorkerClient } from '../audio/worker/AudioAnalysisWorkerClient';
import { buildAudioBufferFromChannels } from '../audio/buildAudioBufferFromChannels';
import { decodeAudioFile } from '../audio/decodeAudioFile';
import { deriveExportFileName } from '../audio/deriveExportFileName';
import { downloadBlob } from '../utils/downloadBlob';
import { encodeMp3 } from '../audio/encodeMp3';
import { encodeWav } from '../audio/encodeWav';
import { cascadeMinLengthOrdering } from '../audio/minLengthOrdering';
import { PreviewPlaybackController } from '../audio/PreviewPlaybackController';
import { clearPersistedSession, loadPersistedSession, savePersistedSession } from './persistedSession';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import type { DetectionConfig, ExportAudioFormat, SilenceCategoryKey, SilenceRegion } from '../audio/types';

const REGION_RECOMPUTE_DEBOUNCE_MILLISECONDS = 150;
const SETTINGS_PERSIST_DEBOUNCE_MILLISECONDS = 300;

export const uploadedFileName = signal<string | null>(null);
export const isAnalyzingAudio = signal(false);
export const isExportingAudio = signal(false);
export const errorMessage = signal<string | null>(null);

export const amplitudeEnvelope = signal<SerializedAmplitudeEnvelope | null>(null);
export const detectionConfig = signal<DetectionConfig | null>(null);
export const silenceRegions = signal<SilenceRegion[]>([]);
export const exportFormat = signal<ExportAudioFormat>('wav');

export const isPlaybackPlaying = signal(false);
export const playbackCurrentTimeSeconds = signal(0);

let activeWorkerClient: AudioAnalysisWorkerClient | null = null;
let activePlaybackController: PreviewPlaybackController | null = null;
let activeFile: File | null = null;
let regionRecomputeTimeoutId: ReturnType<typeof setTimeout> | null = null;
let settingsPersistTimeoutId: ReturnType<typeof setTimeout> | null = null;

export async function loadAudioFile(file: File, restoredConfig?: DetectionConfig): Promise<void> {
  resetAudioFile();
  errorMessage.value = null;
  isAnalyzingAudio.value = true;

  try {
    const decodedAudio = await decodeAudioFile(file);

    // Built before handing channelData off to the worker: `workerClient.loadAudio` transfers (detaches) those
    // buffers, but the AudioBuffer already owns its own independent copy at that point.
    const playbackController = new PreviewPlaybackController(buildAudioBufferFromChannels(decodedAudio.channelData, decodedAudio.sampleRate));
    playbackController.onTimeUpdate = seconds => {
      playbackCurrentTimeSeconds.value = seconds;
    };
    playbackController.onPlaybackStateChange = playing => {
      isPlaybackPlaying.value = playing;
    };
    activePlaybackController = playbackController;

    const workerClient = new AudioAnalysisWorkerClient();
    activeWorkerClient = workerClient;

    const { envelope, defaultConfig } = await workerClient.loadAudio(decodedAudio.channelData, decodedAudio.sampleRate);
    const configToUse = restoredConfig ?? defaultConfig;
    const regions = await workerClient.detectRegions(configToUse);

    uploadedFileName.value = file.name;
    amplitudeEnvelope.value = envelope;
    detectionConfig.value = configToUse;
    silenceRegions.value = regions;
    playbackController.updateSegments(regions, configToUse);

    activeFile = file;
    void savePersistedSession({ fileBlob: file, fileName: file.name, detectionConfig: configToUse, exportFormat: exportFormat.value });
  } catch (caughtError) {
    errorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not read this audio file.';
    resetAudioFile();
  } finally {
    isAnalyzingAudio.value = false;
  }
}

/** Restores a file/settings saved by a previous visit, if any. Call once on app startup. */
export async function restoreSession(): Promise<void> {
  const persisted = await loadPersistedSession().catch(() => null);
  if (!persisted) return;

  exportFormat.value = persisted.exportFormat;
  const file = new File([persisted.fileBlob], persisted.fileName, { type: persisted.fileBlob.type });
  await loadAudioFile(file, persisted.detectionConfig);
}

function scheduleSettingsPersist(): void {
  if (settingsPersistTimeoutId !== null) clearTimeout(settingsPersistTimeoutId);

  settingsPersistTimeoutId = setTimeout(() => {
    settingsPersistTimeoutId = null;
    const config = detectionConfig.value;
    if (!config || !activeFile) return;

    void savePersistedSession({
      fileBlob: activeFile,
      fileName: activeFile.name,
      detectionConfig: config,
      exportFormat: exportFormat.value,
    });
  }, SETTINGS_PERSIST_DEBOUNCE_MILLISECONDS);
}

export function resetAudioFile(): void {
  activeWorkerClient?.terminate();
  activeWorkerClient = null;
  activePlaybackController?.dispose();
  activePlaybackController = null;
  activeFile = null;
  if (regionRecomputeTimeoutId !== null) {
    clearTimeout(regionRecomputeTimeoutId);
    regionRecomputeTimeoutId = null;
  }
  if (settingsPersistTimeoutId !== null) {
    clearTimeout(settingsPersistTimeoutId);
    settingsPersistTimeoutId = null;
  }

  uploadedFileName.value = null;
  amplitudeEnvelope.value = null;
  detectionConfig.value = null;
  silenceRegions.value = [];
  errorMessage.value = null;
  isPlaybackPlaying.value = false;
  playbackCurrentTimeSeconds.value = 0;
}

/** Used by the user-facing "Reset" action: clears in-memory state *and* the persisted session, unlike the
 * plain `resetAudioFile()` above which also runs internally at the top of every `loadAudioFile()` call and
 * must not wipe storage that `restoreSession()` is in the middle of reading. */
export function resetAudioFileAndClearStorage(): void {
  resetAudioFile();
  void clearPersistedSession();
}

function syncPlaybackSegments(): void {
  const config = detectionConfig.value;
  if (activePlaybackController && config) activePlaybackController.updateSegments(silenceRegions.value, config);
}

function scheduleRegionRecompute(): void {
  if (regionRecomputeTimeoutId !== null) clearTimeout(regionRecomputeTimeoutId);

  regionRecomputeTimeoutId = setTimeout(() => {
    regionRecomputeTimeoutId = null;
    const workerClient = activeWorkerClient;
    const config = detectionConfig.value;
    if (!workerClient || !config) return;

    void workerClient.detectRegions(config).then(regions => {
      silenceRegions.value = regions;
      syncPlaybackSegments();
    });
  }, REGION_RECOMPUTE_DEBOUNCE_MILLISECONDS);
}

export function updateVolumeThresholdPercent(volumeThresholdPercent: number): void {
  const currentConfig = detectionConfig.value;
  if (!currentConfig) return;

  detectionConfig.value = { ...currentConfig, volumeThresholdPercent };
  scheduleRegionRecompute();
  scheduleSettingsPersist();
}

export function updateCategoryMinLengthSeconds(category: SilenceCategoryKey, minLengthSeconds: number): void {
  const currentConfig = detectionConfig.value;
  if (!currentConfig) return;

  const recascadedMinLengths = cascadeMinLengthOrdering(
    {
      short: currentConfig.short.minLengthSeconds,
      medium: currentConfig.medium.minLengthSeconds,
      long: currentConfig.long.minLengthSeconds,
      [category]: minLengthSeconds,
    },
    category,
  );

  detectionConfig.value = {
    ...currentConfig,
    short: { ...currentConfig.short, minLengthSeconds: recascadedMinLengths.short },
    medium: { ...currentConfig.medium, minLengthSeconds: recascadedMinLengths.medium },
    long: { ...currentConfig.long, minLengthSeconds: recascadedMinLengths.long },
  };
  scheduleRegionRecompute();
  scheduleSettingsPersist();
}

export function updateCategoryReplacedLengthSeconds(category: SilenceCategoryKey, replacedLengthSeconds: number): void {
  const currentConfig = detectionConfig.value;
  if (!currentConfig) return;

  detectionConfig.value = {
    ...currentConfig,
    [category]: { ...currentConfig[category], replacedLengthSeconds },
  };
  // Replaced length doesn't change which regions are detected, only how much of each gets cut/skipped.
  syncPlaybackSegments();
  scheduleSettingsPersist();
}

export function updateCategoryAudibleLengthSeconds(category: SilenceCategoryKey, audibleLengthSeconds: number): void {
  const currentConfig = detectionConfig.value;
  if (!currentConfig) return;

  detectionConfig.value = {
    ...currentConfig,
    [category]: { ...currentConfig[category], audibleLengthSeconds },
  };
  scheduleRegionRecompute();
  scheduleSettingsPersist();
}

export function setExportFormat(format: ExportAudioFormat): void {
  exportFormat.value = format;
  scheduleSettingsPersist();
}

export function togglePlayback(): void {
  if (!activePlaybackController) return;
  if (isPlaybackPlaying.value) {
    activePlaybackController.pause();
  } else {
    activePlaybackController.play();
  }
}

export function restartPlayback(): void {
  activePlaybackController?.restart();
}

export function seekPlaybackAndPlay(originalTimeSeconds: number): void {
  activePlaybackController?.play(originalTimeSeconds);
}

export async function exportCurrentAudio(): Promise<void> {
  const workerClient = activeWorkerClient;
  const config = detectionConfig.value;
  const fileName = uploadedFileName.value;
  if (!workerClient || !config || !fileName) return;

  errorMessage.value = null;
  isExportingAudio.value = true;

  try {
    const { channelData, sampleRate } = await workerClient.cutAudio(silenceRegions.value, config);
    const blob = exportFormat.value === 'mp3' ? await encodeMp3(channelData, sampleRate) : encodeWav(channelData, sampleRate);
    downloadBlob(blob, deriveExportFileName(fileName, exportFormat.value));
  } catch (caughtError) {
    errorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not export this audio file.';
  } finally {
    isExportingAudio.value = false;
  }
}
