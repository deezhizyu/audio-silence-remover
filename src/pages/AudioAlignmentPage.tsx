import { AlignmentMetricsPanel } from '../components/AlignmentMetricsPanel';
import { AlignmentWaveforms } from '../components/AlignmentWaveforms';
import { Dropzone } from '../components/Dropzone';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { RangeControl } from '../components/ui/RangeControl';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Toggle } from '../components/ui/Toggle';
import { fadeUpEntranceStyle } from '../utils/fadeUpEntranceStyle';
import {
  alignmentMetrics,
  cutEdgeSilenceEnabled,
  exportAlignedVideo,
  exportErrorMessage,
  isExportingVideo,
  isLoadingVideoSource,
  isLoadingVoiceChangedSource,
  loadOriginalVideoFile,
  loadVoiceChangedAudioFile,
  originalVideoEnvelope,
  originalVideoFileName,
  resetAudioAlignmentSession,
  setCutEdgeSilenceEnabled,
  updateVolumeThresholdPercent,
  voiceChangedAudioEnvelope,
  voiceChangedAudioFileName,
  voiceChangedSourceErrorMessage,
  videoSourceErrorMessage,
  volumeThresholdPercent,
} from '../state/audioAlignmentSignals';

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

  return (
    <main class="mx-auto max-w-5xl px-6 pb-10">
      <div class="mx-auto mt-6 max-w-2xl px-6 pb-8 pt-14 text-center">
        <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Audio Alignment</h1>
        <p class="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-text-secondary">
          Fix the padding an AI voice changer adds to your dialogue: line up the voice-changed audio with your
          original video, then export the video with just the audio swapped — same quality, same picture.
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
          <div style={fadeUpEntranceStyle(2)}>
            <AlignmentWaveforms originalVideoEnvelope={originalEnvelope} voiceChangedAudioEnvelope={voiceChangedEnvelope} metrics={alignmentMetrics.value} />
          </div>

          <div style={fadeUpEntranceStyle(3)}>
            <Card>
              <SectionHeading
                title="Silence threshold"
                description="Audio quieter than this threshold of each file's peak volume counts as silence."
              />
              <div class="mt-4">
                <RangeControl
                  label="Threshold"
                  value={volumeThresholdPercent.value}
                  min={1}
                  max={50}
                  step={1}
                  unit="%"
                  onChange={updateVolumeThresholdPercent}
                />
              </div>
              <div class="mt-5 border-t border-border-subtle pt-5">
                <Toggle
                  label="Also trim any remaining silence at the edges"
                  checked={cutEdgeSilenceEnabled.value}
                  onChange={setCutEdgeSilenceEnabled}
                />
              </div>
            </Card>
          </div>

          <div style={fadeUpEntranceStyle(4)}>
            <AlignmentMetricsPanel metrics={alignmentMetrics.value} />
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
