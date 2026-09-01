import { useEffect } from 'preact/hooks';
import { CategoryPanel } from '../components/CategoryPanel';
import { Dropzone } from '../components/Dropzone';
import { ExportBar } from '../components/ExportBar';
import { GlobalControls } from '../components/GlobalControls';
import { Hero } from '../components/Hero';
import { Legend } from '../components/Legend';
import { PlaybackControls } from '../components/PlaybackControls';
import { Waveform } from '../components/Waveform';
import { SILENCE_CATEGORY_KEYS, type SilenceCategoryKey } from '../audio/types';
import { fadeUpEntranceStyle } from '../utils/fadeUpEntranceStyle';
import {
  amplitudeEnvelope,
  detectionConfig,
  errorMessage,
  exportCurrentAudio,
  exportFormat,
  isAnalyzingAudio,
  isExportingAudio,
  isPlaybackPlaying,
  loadAudioFile,
  playbackCurrentTimeSeconds,
  processedDurationSeconds,
  resetAudioFileAndClearStorage,
  restartPlayback,
  restoreSession,
  seekPlaybackAndPlay,
  setExportFormat,
  silenceRegions,
  togglePlayback,
  updateCategoryAudibleLengthSeconds,
  updateCategoryMinLengthSeconds,
  updateCategoryReplacedLengthSeconds,
  updateVolumeThresholdPercent,
  uploadedFileName,
} from '../state/signals';

function handleFilesSelected(files: File[]): void {
  const file = files[0];
  if (file) void loadAudioFile(file);
}

function handleDownload(): void {
  void exportCurrentAudio();
}

export function SilenceRemoverPage() {
  useEffect(() => {
    void restoreSession();
  }, []);

  // Global play/pause shortcut. Skipped whenever something else is focused (a slider, a button, the file
  // input, …) so it doesn't fight that element's own use of the key — e.g. Space re-clicking a focused button.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (document.activeElement !== document.body) return;
      if (uploadedFileName.value === null) return;

      event.preventDefault();
      togglePlayback();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fileName = uploadedFileName.value;
  const isAnalyzing = isAnalyzingAudio.value;
  const envelope = amplitudeEnvelope.value;
  const config = detectionConfig.value;
  const isFileLoaded = fileName !== null && envelope !== null && config !== null;

  return (
    <main class="mx-auto max-w-5xl px-6 pb-10">
      <Hero />

      {!isFileLoaded && (
        <div class="flex flex-col gap-4">
          <div style={fadeUpEntranceStyle(1)}>
            <Dropzone onFilesSelected={handleFilesSelected} disabled={isAnalyzing} />
          </div>
          {isAnalyzing && <p class="text-center text-xs text-text-tertiary">Analyzing audio and choosing starting defaults…</p>}
          {errorMessage.value && <p class="text-center text-xs text-danger">{errorMessage.value}</p>}
        </div>
      )}

      {isFileLoaded && envelope && config && (
        <div class="flex flex-col gap-6 pt-8">
          <div class="flex flex-wrap items-center justify-between gap-3" style={fadeUpEntranceStyle(0)}>
            <h2 class="truncate text-sm font-medium text-text-primary">{fileName}</h2>
            <Legend />
          </div>

          <div class="flex flex-col gap-3" style={fadeUpEntranceStyle(1)}>
            <Waveform
              envelope={envelope}
              regions={silenceRegions.value}
              currentTimeSecondsSignal={playbackCurrentTimeSeconds}
              onSeek={seekPlaybackAndPlay}
            />
            <PlaybackControls
              isPlayingSignal={isPlaybackPlaying}
              currentTimeSecondsSignal={playbackCurrentTimeSeconds}
              processedDurationSecondsSignal={processedDurationSeconds}
              durationSeconds={envelope.durationSeconds}
              onTogglePlayback={togglePlayback}
              onRestart={restartPlayback}
            />
          </div>

          <div style={fadeUpEntranceStyle(2)}>
            <GlobalControls volumeThresholdPercent={config.volumeThresholdPercent} onVolumeThresholdChange={updateVolumeThresholdPercent} />
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SILENCE_CATEGORY_KEYS.map((category: SilenceCategoryKey, index) => (
              <div key={category} style={fadeUpEntranceStyle(3 + index)}>
                <CategoryPanel
                  category={category}
                  config={config[category]}
                  onMinLengthChange={seconds => updateCategoryMinLengthSeconds(category, seconds)}
                  onReplacedLengthChange={seconds => updateCategoryReplacedLengthSeconds(category, seconds)}
                  onAudibleLengthChange={seconds => updateCategoryAudibleLengthSeconds(category, seconds)}
                />
              </div>
            ))}
          </div>

          <div style={fadeUpEntranceStyle(6)}>
            <ExportBar
              exportFormat={exportFormat.value}
              onExportFormatChange={setExportFormat}
              onDownload={handleDownload}
              onReset={resetAudioFileAndClearStorage}
              isExporting={isExportingAudio.value}
              errorMessage={errorMessage.value}
            />
          </div>
        </div>
      )}
    </main>
  );
}
