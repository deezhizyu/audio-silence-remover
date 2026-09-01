import { AlignmentPlaybackPreview } from '../components/AlignmentPlaybackPreview';
import { Dropzone } from '../components/Dropzone';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { fadeUpEntranceStyle } from '../utils/fadeUpEntranceStyle';
import {
  exportBatch,
  exportErrorMessage,
  exportFailures,
  exportProgress,
  isExportingBatch,
  matchedPairs,
  originalVideoFiles,
  resetAudioAlignmentSession,
  setOriginalVideoFiles,
  setVoiceChangedAudioFiles,
  unmatchedAudioFiles,
  unmatchedVideoFiles,
  voiceChangedAudioFiles,
} from '../state/audioAlignmentSignals';

function handleExport(): void {
  void exportBatch();
}

export function AudioAlignmentPage() {
  const videoFiles = originalVideoFiles.value;
  const audioFiles = voiceChangedAudioFiles.value;
  const pairs = matchedPairs.value;
  const unmatchedVideos = unmatchedVideoFiles.value;
  const unmatchedAudios = unmatchedAudioFiles.value;
  const hasAnyFiles = videoFiles.length > 0 || audioFiles.length > 0;
  const progress = exportProgress.value;

  return (
    <main class="mx-auto max-w-5xl px-6 pb-10">
      <div class="mx-auto mt-6 max-w-2xl px-6 pb-8 pt-14 text-center">
        <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Audio Alignment</h1>
        <p class="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-text-secondary">
          Fix the padding an AI voice changer adds to your dialogue, in bulk. Drop your original videos
          and their voice-changed audio — matched automatically by filename — tune one offset against a
          preview, then export the whole batch with that offset applied to every pair.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div style={fadeUpEntranceStyle(0)} class="flex flex-col gap-2">
          <Dropzone
            onFilesSelected={setOriginalVideoFiles}
            multiple
            accept="video/mp4,video/quicktime,.mp4,.mov"
            heading="Drop your original videos here"
            subtext="MP4 or MOV — the source videos with the original dialogue"
          />
          {videoFiles.length > 0 && (
            <p class="text-center text-xs text-text-tertiary">
              {videoFiles.length} video{videoFiles.length === 1 ? '' : 's'} selected
            </p>
          )}
        </div>

        <div style={fadeUpEntranceStyle(1)} class="flex flex-col gap-2">
          <Dropzone
            onFilesSelected={setVoiceChangedAudioFiles}
            multiple
            accept="audio/*"
            heading="Drop your voice-changed audio here"
            subtext="The audio files that came back from your voice changer"
          />
          {audioFiles.length > 0 && (
            <p class="text-center text-xs text-text-tertiary">
              {audioFiles.length} audio file{audioFiles.length === 1 ? '' : 's'} selected
            </p>
          )}
        </div>
      </div>

      {hasAnyFiles && (
        <div style={fadeUpEntranceStyle(2)} class="mt-4">
          <Card>
            <SectionHeading title="Matched pairs" description="Videos and audio files are paired by matching filename, ignoring the extension." />
            <div class="mt-3 flex flex-col gap-2 text-xs">
              <p class="text-text-secondary">
                {pairs.length} pair{pairs.length === 1 ? '' : 's'} matched
              </p>
              {unmatchedVideos.length > 0 && (
                <p class="text-danger">
                  No matching audio for: {unmatchedVideos.map(file => file.name).join(', ')}
                </p>
              )}
              {unmatchedAudios.length > 0 && (
                <p class="text-danger">
                  No matching video for: {unmatchedAudios.map(file => file.name).join(', ')}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {pairs.length > 0 && (
        <div class="mt-8 flex flex-col gap-6">
          <div style={fadeUpEntranceStyle(3)}>
            <AlignmentPlaybackPreview />
          </div>

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
