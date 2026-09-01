import { signal } from '@preact/signals';
import { AlignmentPreviewPlaybackController, type AlignmentPlaybackSource } from '../audio/AlignmentPreviewPlaybackController';
import { buildAudioBufferFromChannels } from '../audio/buildAudioBufferFromChannels';
import { deriveAlignedVideoFileName } from '../audio/deriveAlignedVideoFileName';
import { AudioAlignmentWorkerClient } from '../audio/worker/AudioAlignmentWorkerClient';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { downloadBlob } from '../utils/downloadBlob';

export const originalVideoFileName = signal<string | null>(null);
export const voiceChangedAudioFileName = signal<string | null>(null);

export const offsetSeconds = signal(0);
export const trimStartSeconds = signal(0);
export const trimEndSeconds = signal(0);

/** The point (on the original/shared timeline) the user last clicked to zoom in on — `null` means fully
    zoomed out, showing each waveform's full duration. */
export const zoomCenterSeconds = signal<number | null>(null);

export const isLoadingVideoSource = signal(false);
export const isLoadingVoiceChangedSource = signal(false);
export const isExportingVideo = signal(false);

/** Kept independent per source (rather than one shared signal) since the two loads run concurrently and
    resolve in whichever order the browser finishes them — a shared signal would let one load's success
    silently wipe out the other's still-relevant error, or vice versa. */
export const videoSourceErrorMessage = signal<string | null>(null);
export const voiceChangedSourceErrorMessage = signal<string | null>(null);
export const exportErrorMessage = signal<string | null>(null);

export const originalVideoEnvelope = signal<SerializedAmplitudeEnvelope | null>(null);
export const voiceChangedAudioEnvelope = signal<SerializedAmplitudeEnvelope | null>(null);
export const originalVideoDurationSeconds = signal(0);
export const voiceChangedAudioDurationSeconds = signal(0);

/** Feeds the `<video>` element's `src` — an object URL for the uploaded video file. */
export const videoObjectUrl = signal<string | null>(null);

export const activePlaybackSource = signal<AlignmentPlaybackSource | null>(null);
export const isPlaybackPlaying = signal(false);
export const playbackCurrentTimeSeconds = signal(0);

let activeWorkerClient: AudioAlignmentWorkerClient | null = null;
let activePlaybackController: AlignmentPreviewPlaybackController | null = null;

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

export async function loadOriginalVideoFile(file: File): Promise<void> {
  videoSourceErrorMessage.value = null;
  isLoadingVideoSource.value = true;
  originalVideoEnvelope.value = null;

  try {
    const { envelope, durationSeconds } = await ensureWorkerClient().loadVideoSource(file);
    originalVideoEnvelope.value = envelope;
    originalVideoDurationSeconds.value = durationSeconds;
    originalVideoFileName.value = file.name;

    if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value);
    videoObjectUrl.value = URL.createObjectURL(file);
  } catch (caughtError) {
    videoSourceErrorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not read this video file.';
    originalVideoFileName.value = null;
  } finally {
    isLoadingVideoSource.value = false;
  }
}

export async function loadVoiceChangedAudioFile(file: File): Promise<void> {
  voiceChangedSourceErrorMessage.value = null;
  isLoadingVoiceChangedSource.value = true;
  voiceChangedAudioEnvelope.value = null;
  ensurePlaybackController().setVoiceChangedBuffer(null);

  try {
    const { envelope, durationSeconds, channelData, sampleRate } = await ensureWorkerClient().loadVoiceChangedSource(file);
    voiceChangedAudioEnvelope.value = envelope;
    voiceChangedAudioDurationSeconds.value = durationSeconds;
    voiceChangedAudioFileName.value = file.name;
    ensurePlaybackController().setVoiceChangedBuffer(buildAudioBufferFromChannels(channelData, sampleRate));
  } catch (caughtError) {
    voiceChangedSourceErrorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not read this audio file.';
    voiceChangedAudioFileName.value = null;
  } finally {
    isLoadingVoiceChangedSource.value = false;
  }
}

export function updateOffsetSeconds(seconds: number): void {
  offsetSeconds.value = seconds;
}

export function updateTrimStartSeconds(seconds: number): void {
  trimStartSeconds.value = seconds;
}

export function updateTrimEndSeconds(seconds: number): void {
  trimEndSeconds.value = seconds;
}

export function setZoomCenterSeconds(seconds: number | null): void {
  zoomCenterSeconds.value = seconds;
}

export function playOriginalAudio(fromSeconds?: number): void {
  ensurePlaybackController().playOriginal(fromSeconds);
}

export function playVoiceChangedAudio(fromSeconds?: number): void {
  ensurePlaybackController().playVoiceChanged(fromSeconds, offsetSeconds.value, trimStartSeconds.value, trimEndSeconds.value);
}

export function pausePlayback(): void {
  activePlaybackController?.pause();
}

export function seekPlayback(seconds: number): void {
  ensurePlaybackController().seek(seconds, offsetSeconds.value, trimStartSeconds.value, trimEndSeconds.value);
}

export async function exportAlignedVideo(): Promise<void> {
  const workerClient = activeWorkerClient;
  const fileName = originalVideoFileName.value;
  if (!workerClient || !fileName || !voiceChangedAudioFileName.value) return;

  exportErrorMessage.value = null;
  isExportingVideo.value = true;

  try {
    const { fileBytes, containerFormat } = await workerClient.exportAlignedVideo(offsetSeconds.value, trimStartSeconds.value, trimEndSeconds.value);
    const mimeType = containerFormat === 'mov' ? 'video/quicktime' : 'video/mp4';
    downloadBlob(new Blob([fileBytes], { type: mimeType }), deriveAlignedVideoFileName(fileName));
  } catch (caughtError) {
    exportErrorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not export this video.';
  } finally {
    isExportingVideo.value = false;
  }
}

export function resetAudioAlignmentSession(): void {
  activeWorkerClient?.terminate();
  activeWorkerClient = null;
  activePlaybackController?.pause();
  activePlaybackController?.setVoiceChangedBuffer(null);
  if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value);

  originalVideoFileName.value = null;
  voiceChangedAudioFileName.value = null;
  originalVideoEnvelope.value = null;
  voiceChangedAudioEnvelope.value = null;
  originalVideoDurationSeconds.value = 0;
  voiceChangedAudioDurationSeconds.value = 0;
  videoObjectUrl.value = null;
  offsetSeconds.value = 0;
  trimStartSeconds.value = 0;
  trimEndSeconds.value = 0;
  zoomCenterSeconds.value = null;
  activePlaybackSource.value = null;
  isPlaybackPlaying.value = false;
  playbackCurrentTimeSeconds.value = 0;
  isLoadingVideoSource.value = false;
  isLoadingVoiceChangedSource.value = false;
  isExportingVideo.value = false;
  videoSourceErrorMessage.value = null;
  voiceChangedSourceErrorMessage.value = null;
  exportErrorMessage.value = null;
}
