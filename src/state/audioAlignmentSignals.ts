import { signal } from '@preact/signals';
import { computeAlignmentTrim } from '../audio/computeAlignmentTrim';
import { deriveAlignedVideoFileName } from '../audio/deriveAlignedVideoFileName';
import { detectEdgeSilenceDurations } from '../audio/detectEdgeSilenceDurations';
import { AudioAlignmentWorkerClient } from '../audio/worker/AudioAlignmentWorkerClient';
import type { SerializedAmplitudeEnvelope } from '../audio/worker/workerMessages';
import { downloadBlob } from '../utils/downloadBlob';

const THRESHOLD_RECOMPUTE_DEBOUNCE_MILLISECONDS = 150;
const DEFAULT_VOLUME_THRESHOLD_PERCENT = 10;

export interface AlignmentMetrics {
  originalLeadingSilenceSeconds: number;
  voiceChangedLeadingSilenceSeconds: number;
  startTrimSeconds: number;
  endTrimSeconds: number;
  originalAudioDurationSeconds: number;
  resultingDurationSeconds: number;
}

export const originalVideoFileName = signal<string | null>(null);
export const voiceChangedAudioFileName = signal<string | null>(null);
export const volumeThresholdPercent = signal(DEFAULT_VOLUME_THRESHOLD_PERCENT);
export const cutEdgeSilenceEnabled = signal(false);

export const isLoadingVideoSource = signal(false);
export const isLoadingVoiceChangedSource = signal(false);
export const isExportingVideo = signal(false);
export const errorMessage = signal<string | null>(null);

/** Live preview only — reflects the alignment trim (step 1), not the optional extra edge-silence trim
    applied at export time, since that step needs the actual trimmed PCM, which stays worker-side. */
export const alignmentMetrics = signal<AlignmentMetrics | null>(null);

let activeWorkerClient: AudioAlignmentWorkerClient | null = null;
let retainedOriginalEnvelope: SerializedAmplitudeEnvelope | null = null;
let retainedOriginalAudioDurationSeconds = 0;
let retainedVoiceChangedEnvelope: SerializedAmplitudeEnvelope | null = null;
let retainedVoiceChangedDurationSeconds = 0;
let metricsRecomputeTimeoutId: ReturnType<typeof setTimeout> | null = null;

function ensureWorkerClient(): AudioAlignmentWorkerClient {
  if (!activeWorkerClient) activeWorkerClient = new AudioAlignmentWorkerClient();
  return activeWorkerClient;
}

function recomputeAlignmentMetrics(): void {
  if (!retainedOriginalEnvelope || !retainedVoiceChangedEnvelope) {
    alignmentMetrics.value = null;
    return;
  }

  const threshold = volumeThresholdPercent.value;
  const originalEdgeSilence = detectEdgeSilenceDurations(retainedOriginalEnvelope, threshold);
  const voiceChangedEdgeSilence = detectEdgeSilenceDurations(retainedVoiceChangedEnvelope, threshold);
  const { startTrimSeconds, endTrimSeconds } = computeAlignmentTrim({
    originalLeadingSilenceSeconds: originalEdgeSilence.leadingSilenceSeconds,
    originalAudioDurationSeconds: retainedOriginalAudioDurationSeconds,
    voiceChangedLeadingSilenceSeconds: voiceChangedEdgeSilence.leadingSilenceSeconds,
    voiceChangedDurationSeconds: retainedVoiceChangedDurationSeconds,
  });

  alignmentMetrics.value = {
    originalLeadingSilenceSeconds: originalEdgeSilence.leadingSilenceSeconds,
    voiceChangedLeadingSilenceSeconds: voiceChangedEdgeSilence.leadingSilenceSeconds,
    startTrimSeconds,
    endTrimSeconds,
    originalAudioDurationSeconds: retainedOriginalAudioDurationSeconds,
    resultingDurationSeconds: retainedVoiceChangedDurationSeconds - startTrimSeconds - endTrimSeconds,
  };
}

function scheduleMetricsRecompute(): void {
  if (metricsRecomputeTimeoutId !== null) clearTimeout(metricsRecomputeTimeoutId);

  metricsRecomputeTimeoutId = setTimeout(() => {
    metricsRecomputeTimeoutId = null;
    recomputeAlignmentMetrics();
  }, THRESHOLD_RECOMPUTE_DEBOUNCE_MILLISECONDS);
}

export async function loadOriginalVideoFile(file: File): Promise<void> {
  errorMessage.value = null;
  isLoadingVideoSource.value = true;
  retainedOriginalEnvelope = null;
  alignmentMetrics.value = null;

  try {
    const { envelope, durationSeconds } = await ensureWorkerClient().loadVideoSource(file);
    retainedOriginalEnvelope = envelope;
    retainedOriginalAudioDurationSeconds = durationSeconds;
    originalVideoFileName.value = file.name;
    recomputeAlignmentMetrics();
  } catch (caughtError) {
    errorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not read this video file.';
    originalVideoFileName.value = null;
  } finally {
    isLoadingVideoSource.value = false;
  }
}

export async function loadVoiceChangedAudioFile(file: File): Promise<void> {
  errorMessage.value = null;
  isLoadingVoiceChangedSource.value = true;
  retainedVoiceChangedEnvelope = null;
  alignmentMetrics.value = null;

  try {
    const { envelope, durationSeconds } = await ensureWorkerClient().loadVoiceChangedSource(file);
    retainedVoiceChangedEnvelope = envelope;
    retainedVoiceChangedDurationSeconds = durationSeconds;
    voiceChangedAudioFileName.value = file.name;
    recomputeAlignmentMetrics();
  } catch (caughtError) {
    errorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not read this audio file.';
    voiceChangedAudioFileName.value = null;
  } finally {
    isLoadingVoiceChangedSource.value = false;
  }
}

export function updateVolumeThresholdPercent(percent: number): void {
  volumeThresholdPercent.value = percent;
  scheduleMetricsRecompute();
}

export function setCutEdgeSilenceEnabled(enabled: boolean): void {
  cutEdgeSilenceEnabled.value = enabled;
}

export async function exportAlignedVideo(): Promise<void> {
  const workerClient = activeWorkerClient;
  const fileName = originalVideoFileName.value;
  if (!workerClient || !fileName || !voiceChangedAudioFileName.value) return;

  errorMessage.value = null;
  isExportingVideo.value = true;

  try {
    const { fileBytes, containerFormat } = await workerClient.exportAlignedVideo(volumeThresholdPercent.value, cutEdgeSilenceEnabled.value);
    const mimeType = containerFormat === 'mov' ? 'video/quicktime' : 'video/mp4';
    downloadBlob(new Blob([fileBytes], { type: mimeType }), deriveAlignedVideoFileName(fileName));
  } catch (caughtError) {
    errorMessage.value = caughtError instanceof Error ? caughtError.message : 'Could not export this video.';
  } finally {
    isExportingVideo.value = false;
  }
}

export function resetAudioAlignmentSession(): void {
  activeWorkerClient?.terminate();
  activeWorkerClient = null;
  retainedOriginalEnvelope = null;
  retainedOriginalAudioDurationSeconds = 0;
  retainedVoiceChangedEnvelope = null;
  retainedVoiceChangedDurationSeconds = 0;
  if (metricsRecomputeTimeoutId !== null) {
    clearTimeout(metricsRecomputeTimeoutId);
    metricsRecomputeTimeoutId = null;
  }

  originalVideoFileName.value = null;
  voiceChangedAudioFileName.value = null;
  volumeThresholdPercent.value = DEFAULT_VOLUME_THRESHOLD_PERCENT;
  cutEdgeSilenceEnabled.value = false;
  isLoadingVideoSource.value = false;
  isLoadingVoiceChangedSource.value = false;
  isExportingVideo.value = false;
  errorMessage.value = null;
  alignmentMetrics.value = null;
}
