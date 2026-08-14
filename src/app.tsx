import { useEffect } from 'preact/hooks';
import { CategoryPanel } from './components/CategoryPanel';
import { Dropzone } from './components/Dropzone';
import { ExportBar } from './components/ExportBar';
import { GlobalControls } from './components/GlobalControls';
import { Hero } from './components/Hero';
import { Legend } from './components/Legend';
import { PlaybackControls } from './components/PlaybackControls';
import { Waveform } from './components/Waveform';
import { SILENCE_CATEGORY_KEYS, type SilenceCategoryKey } from './audio/types';
import { fadeUpEntranceStyle } from './utils/fadeUpEntranceStyle';
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
} from './state/signals';

const REPOSITORY_URL = 'https://github.com/deezhizyu/audio-silence-remover';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.755-1.333-1.755-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .319.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function WaveformLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="9" width="2" height="6" rx="1" />
      <rect x="6" y="3" width="2" height="18" rx="1" />
      <rect x="11" y="7" width="2" height="10" rx="1" />
      <rect x="16" y="1" width="2" height="22" rx="1" />
      <rect x="21" y="5" width="2" height="14" rx="1" />
    </svg>
  );
}

function Header() {
  return (
    <header class="border-b border-border-subtle">
      <div class="flex items-center justify-between gap-3 px-6 py-5">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-surface-base">
            <WaveformLogo />
          </div>
          <h1 class="text-sm font-semibold tracking-wide text-text-primary">Silence Remover</h1>
        </div>
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-200 hover:text-text-primary"
        >
          <GitHubIcon />
        </a>
      </div>
    </header>
  );
}

function handleFileSelected(file: File): void {
  void loadAudioFile(file);
}

function handleDownload(): void {
  void exportCurrentAudio();
}

export function App() {
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
    <div class="min-h-screen bg-surface-base">
      <Header />

      <main class="mx-auto max-w-5xl px-6 pb-10">
        <Hero />

        {!isFileLoaded && (
          <div class="flex flex-col gap-4">
            <div style={fadeUpEntranceStyle(1)}>
              <Dropzone onFileSelected={handleFileSelected} disabled={isAnalyzing} />
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
    </div>
  );
}
