import { AlignmentMetricsPanel } from '../components/AlignmentMetricsPanel';
import { AlignmentPlaybackPreview } from '../components/AlignmentPlaybackPreview';
import { AlignmentWaveforms } from '../components/AlignmentWaveforms';
import { Dropzone } from '../components/Dropzone';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { RangeControl } from '../components/ui/RangeControl';
import { SectionHeading } from '../components/ui/SectionHeading';
import { fadeUpEntranceStyle } from '../utils/fadeUpEntranceStyle';
import {
  exportAlignedVideo,
  exportErrorMessage,
  isExportingVideo,
  isLoadingVideoSource,
  isLoadingVoiceChangedSource,
  loadOriginalVideoFile,
  loadVoiceChangedAudioFile,
  offsetSeconds,
  originalVideoDurationSeconds,
  originalVideoEnvelope,
  originalVideoFileName,
  resetAudioAlignmentSession,
  trimEndSeconds,
  trimStartSeconds,
  updateOffsetSeconds,
  updateTrimEndSeconds,
  updateTrimStartSeconds,
  voiceChangedAudioDurationSeconds,
  voiceChangedAudioEnvelope,
  voiceChangedAudioFileName,
  voiceChangedSourceErrorMessage,
  videoSourceErrorMessage,
} from '../state/audioAlignmentSignals';

const OFFSET_RANGE_SECONDS = 10;

function handleVideoFileSelected(file: File): void {
  void loadOriginalVideoFile(file);
}

function handleVoiceChangedFileSelected(file: File): void {
  void loadVoiceChangedAudioFile(file);
}

function handleExport(): void {
  void exportAlignedVideo();
}

export function AudioAlignmentPage() {
  const videoFileName = originalVideoFileName.value;
  const audioFileName = voiceChangedAudioFileName.value;
  const originalEnvelope = originalVideoEnvelope.value;
  const voiceChangedEnvelope = voiceChangedAudioEnvelope.value;
  const bothSourcesLoaded = videoFileName !== null && audioFileName !== null && originalEnvelope !== null && voiceChangedEnvelope !== null;
  const voiceChangedDuration = voiceChangedAudioDurationSeconds.value;

  return (
    <main class="mx-auto max-w-5xl px-6 pb-10">
      <div class="mx-auto mt-6 max-w-2xl px-6 pb-8 pt-14 text-center">
        <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Audio Alignment</h1>
        <p class="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-text-secondary">
          Fix the padding an AI voice changer adds to your dialogue: click a point on the waveforms to
          zoom in, drag the offset until they line up by ear and eye, then export the video with just
          the audio swapped — same quality, same picture.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div style={fadeUpEntranceStyle(0)} class="flex flex-col gap-2">
          <Dropzone
            onFileSelected={handleVideoFileSelected}
            disabled={isLoadingVideoSource.value}
            accept="video/mp4,video/quicktime,.mp4,.mov"
            heading="Drop your original video here"
            subtext="MP4 or MOV — the source video with the original dialogue"
          />
          {videoFileName && <p class="truncate text-center text-xs text-text-tertiary">{videoFileName}</p>}
          {videoSourceErrorMessage.value && <p class="text-center text-xs text-danger">{videoSourceErrorMessage.value}</p>}
        </div>

        <div style={fadeUpEntranceStyle(1)} class="flex flex-col gap-2">
          <Dropzone
            onFileSelected={handleVoiceChangedFileSelected}
            disabled={isLoadingVoiceChangedSource.value}
            accept="audio/*"
            heading="Drop your voice-changed audio here"
            subtext="The audio that came back from your voice changer"
          />
          {audioFileName && <p class="truncate text-center text-xs text-text-tertiary">{audioFileName}</p>}
          {voiceChangedSourceErrorMessage.value && <p class="text-center text-xs text-danger">{voiceChangedSourceErrorMessage.value}</p>}
        </div>
      </div>

      {(isLoadingVideoSource.value || isLoadingVoiceChangedSource.value) && (
        <p class="mt-4 text-center text-xs text-text-tertiary">Analyzing audio…</p>
      )}

      {bothSourcesLoaded && (
        <div class="mt-8 flex flex-col gap-6">
          <div style={fadeUpEntranceStyle(2)} class="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div class="lg:w-80 lg:flex-shrink-0">
              <AlignmentPlaybackPreview voiceChangedReady={voiceChangedEnvelope !== null} />
            </div>
            <div class="min-w-0 flex-1">
              <AlignmentWaveforms originalVideoEnvelope={originalEnvelope} voiceChangedAudioEnvelope={voiceChangedEnvelope} />
            </div>
          </div>

          <div style={fadeUpEntranceStyle(3)}>
            <Card>
              <SectionHeading title="Offset and trim" description="Manual controls only — nothing here is auto-detected." />
              <div class="mt-4 flex flex-col gap-5">
                <RangeControl
                  label="Offset"
                  value={offsetSeconds.value}
                  min={-OFFSET_RANGE_SECONDS}
                  max={OFFSET_RANGE_SECONDS}
                  step={0.01}
                  unit="s"
                  onChange={updateOffsetSeconds}
                />
                <RangeControl
                  label="Trim start"
                  value={trimStartSeconds.value}
                  min={0}
                  max={Math.max(voiceChangedDuration, 0.01)}
                  step={0.01}
                  unit="s"
                  onChange={updateTrimStartSeconds}
                />
                <RangeControl
                  label="Trim end"
                  value={trimEndSeconds.value}
                  min={0}
                  max={Math.max(voiceChangedDuration, 0.01)}
                  step={0.01}
                  unit="s"
                  onChange={updateTrimEndSeconds}
                />
              </div>
            </Card>
          </div>

          <div style={fadeUpEntranceStyle(4)}>
            <AlignmentMetricsPanel
              offsetSeconds={offsetSeconds.value}
              trimStartSeconds={trimStartSeconds.value}
              trimEndSeconds={trimEndSeconds.value}
              originalAudioDurationSeconds={originalVideoDurationSeconds.value}
              voiceChangedAudioDurationSeconds={voiceChangedDuration}
            />
          </div>

          <div style={fadeUpEntranceStyle(5)} class="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-5">
            <div class="flex flex-wrap items-center justify-end gap-3">
              <Button variant="ghost" onClick={resetAudioAlignmentSession}>
                Reset
              </Button>
              <Button variant="primary" onClick={handleExport} disabled={isExportingVideo.value}>
                {isExportingVideo.value ? 'Preparing video…' : 'Export video'}
              </Button>
            </div>
            {exportErrorMessage.value && <p class="text-xs text-danger">{exportErrorMessage.value}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
