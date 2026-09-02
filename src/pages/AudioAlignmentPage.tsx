import { AlignmentFileList } from '../components/AlignmentFileList';
import { AlignmentHero } from '../components/AlignmentHero';
import { AlignmentPlaybackPreview } from '../components/AlignmentPlaybackPreview';
import { AlignmentWaveforms } from '../components/AlignmentWaveforms';
import { Dropzone } from '../components/Dropzone';
import { Button } from '../components/ui/Button';
import { fadeUpEntranceStyle } from '../utils/fadeUpEntranceStyle';
import {
  appendSelectedAlignmentFiles,
  exportBatch,
  exportErrorMessage,
  exportFailures,
  exportProgress,
  isExportingBatch,
  matchedPairs,
  originalVideoEnvelope,
  resetAudioAlignmentSession,
  selectedAlignmentFiles,
  voiceChangedAudioEnvelope,
} from '../state/audioAlignmentSignals';

function handleExport(): void {
  void exportBatch();
}

export function AudioAlignmentPage() {
  const pairs = matchedPairs.value;
  const progress = exportProgress.value;
  const originalEnvelope = originalVideoEnvelope.value;
  const voiceChangedEnvelope = voiceChangedAudioEnvelope.value;

  return (
    <main class="mx-auto max-w-5xl px-6 pb-10">
      <AlignmentHero />

      <div style={fadeUpEntranceStyle(0)}>
        <Dropzone
          onFilesSelected={appendSelectedAlignmentFiles}
          multiple
          accept="video/mp4,video/quicktime,.mp4,.mov,audio/*"
          heading="Drop your videos and voice-changed audio here"
          subtext="MP4/MOV videos and their voice-changed audio, mixed together"
        />
      </div>

      {selectedAlignmentFiles.value.length > 0 && (
        <div style={fadeUpEntranceStyle(1)} class="mt-4">
          <AlignmentFileList />
        </div>
      )}

      {pairs.length > 0 && (
        <div class="mt-8 flex flex-col gap-6">
          <div style={fadeUpEntranceStyle(2)}>
            <AlignmentPlaybackPreview />
          </div>

          {originalEnvelope && voiceChangedEnvelope && (
            <div style={fadeUpEntranceStyle(3)}>
              <AlignmentWaveforms originalVideoEnvelope={originalEnvelope} voiceChangedAudioEnvelope={voiceChangedEnvelope} />
            </div>
          )}

          <div style={fadeUpEntranceStyle(4)} class="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-xs text-text-secondary">
                {isExportingBatch.value && progress
                  ? `Processing ${progress.completed} of ${progress.total}…`
                  : `Ready to process ${pairs.length} video${pairs.length === 1 ? '' : 's'} with this offset.`}
              </p>
              <div class="flex flex-wrap items-center gap-3">
                <Button variant="ghost" onClick={resetAudioAlignmentSession}>
                  Reset
                </Button>
                <Button variant="primary" onClick={handleExport} disabled={isExportingBatch.value}>
                  {isExportingBatch.value ? 'Processing…' : `Process batch (${pairs.length})`}
                </Button>
              </div>
            </div>
            {exportErrorMessage.value && <p class="text-xs text-danger">{exportErrorMessage.value}</p>}
            {exportFailures.value.length > 0 && (
              <p class="text-xs text-danger">
                Failed: {exportFailures.value.map(failure => `${failure.baseName} (${failure.message})`).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
