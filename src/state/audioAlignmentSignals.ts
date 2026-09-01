import { computed, signal } from '@preact/signals';
import { AlignmentPreviewPlaybackController, type AlignmentPlaybackSource } from '../audio/AlignmentPreviewPlaybackController';
import { buildAudioBufferFromChannels } from '../audio/buildAudioBufferFromChannels';
import { AudioAlignmentWorkerClient } from '../audio/worker/AudioAlignmentWorkerClient';
import type { AlignmentBatchPairFailure, AlignmentBatchPairInput } from '../audio/worker/audioAlignmentWorkerMessages';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { downloadBlob } from '../utils/downloadBlob';

export interface MatchedAlignmentPair {
  baseName: string;
  videoFile: File;
  audioFile: File;
}

function fileBaseName(file: File): string {
  return file.name.replace(/\.[^./\\]+$/, '').trim().toLowerCase();
}

export const originalVideoFiles = signal<File[]>([]);
export const voiceChangedAudioFiles = signal<File[]>([]);

/** Pairs matched by filename (ignoring extension and case), sorted for a stable, predictable order. */
export const matchedPairs = computed<MatchedAlignmentPair[]>(() => {
  const audioFilesByBaseName = new Map(voiceChangedAudioFiles.value.map(file => [fileBaseName(file), file]));
  const pairs: MatchedAlignmentPair[] = [];
  for (const videoFile of originalVideoFiles.value) {
    const audioFile = audioFilesByBaseName.get(fileBaseName(videoFile));
    if (audioFile) pairs.push({ baseName: fileBaseName(videoFile), videoFile, audioFile });
  }
  return pairs.sort((a, b) => a.baseName.localeCompare(b.baseName));
});

export const unmatchedVideoFiles = computed<File[]>(() => {
  const matchedBaseNames = new Set(matchedPairs.value.map(pair => pair.baseName));
  return originalVideoFiles.value.filter(file => !matchedBaseNames.has(fileBaseName(file)));
});

export const unmatchedAudioFiles = computed<File[]>(() => {
  const matchedBaseNames = new Set(matchedPairs.value.map(pair => pair.baseName));
  return voiceChangedAudioFiles.value.filter(file => !matchedBaseNames.has(fileBaseName(file)));
});

export const offsetSeconds = signal(0);

/** The point (on the original video's timeline) the user last clicked to zoom in on — `null` means fully
    zoomed out, showing each waveform's full duration. */
export const zoomCenterSeconds = signal<number | null>(null);

export const isLoadingPreview = signal(false);
export const previewErrorMessage = signal<string | null>(null);
/** Feeds the `<video>` element's `src` — an object URL for the reference pair's video file. */
export const previewVideoObjectUrl = signal<string | null>(null);
export const originalVideoEnvelope = signal<SerializedAmplitudeEnvelope | null>(null);
export const voiceChangedAudioEnvelope = signal<SerializedAmplitudeEnvelope | null>(null);

export const activePlaybackSource = signal<AlignmentPlaybackSource | null>(null);
export const isPlaybackPlaying = signal(false);
export const playbackCurrentTimeSeconds = signal(0);

export const isExportingBatch = signal(false);
export const exportErrorMessage = signal<string | null>(null);
export const exportProgress = signal<{ completed: number; total: number } | null>(null);
export const exportFailures = signal<AlignmentBatchPairFailure[]>([]);

let activeWorkerClient: AudioAlignmentWorkerClient | null = null;
let activePlaybackController: AlignmentPreviewPlaybackController | null = null;
let loadedPreviewBaseName: string | null = null;

function ensureWorkerClient(): AudioAlignmentWorkerClient {
  if (!activeWorkerClient) activeWorkerClient = new AudioAlignmentWorkerClient();
  return activeWorkerClient;
}

/** Constructed lazily (its `AudioContext` along with it) on first use, rather than at module load —
    matches how the silence-remover page only builds its own `PreviewPlaybackController` once a file is
    actually loaded. */
function ensurePlaybackController(): AlignmentPreviewPlaybackController {
  if (activePlaybackController) return activePlaybackController;

  const controller = new AlignmentPreviewPlaybackController();
  controller.onTimeUpdate = seconds => {
    playbackCurrentTimeSeconds.value = seconds;
  };
  controller.onPlaybackStateChange = (isPlaying, source) => {
    isPlaybackPlaying.value = isPlaying;
    if (isPlaying) activePlaybackSource.value = source;
  };
  activePlaybackController = controller;
  return controller;
}

export function attachPlaybackVideoElement(videoElement: HTMLVideoElement | null): void {
  ensurePlaybackController().attachVideoElement(videoElement);
}

/** Loads the first matched pair into the reference preview — the video plays natively (its own `src`,
    no decode needed), and the voice-changed audio is decoded into a Web Audio buffer for offset-shifted
    scheduling. Re-runs whenever either file list changes, but skips reloading if the first pair is
    already the one loaded. */
async function refreshPreviewFromFirstMatchedPair(): Promise<void> {
  const firstPair = matchedPairs.value[0] ?? null;

  if (!firstPair) {
    loadedPreviewBaseName = null;
    activePlaybackController?.pause();
    activePlaybackController?.setVoiceChangedBuffer(null);
    if (previewVideoObjectUrl.value) URL.revokeObjectURL(previewVideoObjectUrl.value);
    previewVideoObjectUrl.value = null;
    originalVideoEnvelope.value = null;
    voiceChangedAudioEnvelope.value = null;
    zoomCenterSeconds.value = null;
    previewErrorMessage.value = null;
    return;
  }

  if (firstPair.baseName === loadedPreviewBaseName) return;
  loadedPreviewBaseName = firstPair.baseName;

  previewErrorMessage.value = null;
  isLoadingPreview.value = true;
  originalVideoEnvelope.value = null;
  voiceChangedAudioEnvelope.value = null;
  zoomCenterSeconds.value = null;
  ensurePlaybackController().pause();
  ensurePlaybackController().setVoiceChangedBuffer(null);

  try {
    if (previewVideoObjectUrl.value) URL.revokeObjectURL(previewVideoObjectUrl.value);
    previewVideoObjectUrl.value = URL.createObjectURL(firstPair.videoFile);

    const { originalVideoEnvelope: videoEnvelope, voiceChangedAudioEnvelope: audioEnvelope, voiceChangedChannelData, voiceChangedSampleRate } =
      await ensureWorkerClient().loadReferencePair(firstPair.videoFile, firstPair.audioFile);
    originalVideoEnvelope.value = videoEnvelope;
    voiceChangedAudioEnvelope.value = audioEnvelope;
    ensurePlaybackController().setVoiceChangedBuffer(buildAudioBufferFromChannels(voiceChangedChannelData, voiceChangedSampleRate));
  } catch (caughtError) {
    previewErrorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not load this pair for preview.';
  } finally {
    isLoadingPreview.value = false;
  }
}

export function setOriginalVideoFiles(files: File[]): void {
  originalVideoFiles.value = files;
  void refreshPreviewFromFirstMatchedPair();
}

export function setVoiceChangedAudioFiles(files: File[]): void {
  voiceChangedAudioFiles.value = files;
  void refreshPreviewFromFirstMatchedPair();
}

export function updateOffsetSeconds(seconds: number): void {
  offsetSeconds.value = seconds;
}

export function setZoomCenterSeconds(seconds: number | null): void {
  zoomCenterSeconds.value = seconds;
}

export function playOriginalAudio(fromSeconds?: number): void {
  ensurePlaybackController().playOriginal(fromSeconds);
}

export function playVoiceChangedAudio(fromSeconds?: number): void {
  ensurePlaybackController().playVoiceChanged(fromSeconds, offsetSeconds.value);
}

export function pausePreview(): void {
  activePlaybackController?.pause();
}

export function seekPreview(seconds: number): void {
  ensurePlaybackController().seek(seconds, offsetSeconds.value);
}

export async function exportBatch(): Promise<void> {
  const pairs: AlignmentBatchPairInput[] = matchedPairs.value.map(({ baseName, videoFile, audioFile }) => ({ baseName, videoFile, audioFile }));
  if (pairs.length === 0) return;

  exportErrorMessage.value = null;
  exportFailures.value = [];
  exportProgress.value = { completed: 0, total: pairs.length };
  isExportingBatch.value = true;

  try {
    const { zipFileBytes, failures } = await ensureWorkerClient().exportBatch(pairs, offsetSeconds.value, (completed, total) => {
      exportProgress.value = { completed, total };
    });
    exportFailures.value = failures;
    if (failures.length < pairs.length) {
      downloadBlob(new Blob([zipFileBytes], { type: 'application/zip' }), 'aligned-videos.zip');
    } else {
      exportErrorMessage.value = 'Every pair in this batch failed to export — see the errors below.';
    }
  } catch (caughtError) {
    exportErrorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not process this batch.';
  } finally {
    isExportingBatch.value = false;
    exportProgress.value = null;
  }
}

export function resetAudioAlignmentSession(): void {
  activeWorkerClient?.terminate();
  activeWorkerClient = null;
  activePlaybackController?.pause();
  activePlaybackController?.setVoiceChangedBuffer(null);
  if (previewVideoObjectUrl.value) URL.revokeObjectURL(previewVideoObjectUrl.value);
  loadedPreviewBaseName = null;

  originalVideoFiles.value = [];
  voiceChangedAudioFiles.value = [];
  offsetSeconds.value = 0;
  zoomCenterSeconds.value = null;
  isLoadingPreview.value = false;
  previewErrorMessage.value = null;
  previewVideoObjectUrl.value = null;
  originalVideoEnvelope.value = null;
  voiceChangedAudioEnvelope.value = null;
  activePlaybackSource.value = null;
  isPlaybackPlaying.value = false;
  playbackCurrentTimeSeconds.value = 0;
  isExportingBatch.value = false;
  exportErrorMessage.value = null;
  exportProgress.value = null;
  exportFailures.value = [];
}
