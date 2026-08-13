import type { ExportAudioFormat } from '../audio/types';
import { Button } from './ui/Button';

interface ExportBarProps {
  exportFormat: ExportAudioFormat;
  onExportFormatChange: (format: ExportAudioFormat) => void;
  onDownload: () => void;
  onReset: () => void;
  isExporting: boolean;
  errorMessage: string | null;
}

const EXPORT_FORMATS: ExportAudioFormat[] = ['wav', 'mp3'];

export function ExportBar({ exportFormat, onExportFormatChange, onDownload, onReset, isExporting, errorMessage }: ExportBarProps) {
  return (
    <div class="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-medium text-text-secondary">Format</span>
          <div class="flex rounded-md border border-border-strong bg-surface-overlay p-0.5">
            {EXPORT_FORMATS.map(format => (
              <button
                key={format}
                type="button"
                onClick={() => onExportFormatChange(format)}
                class={`rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  format === exportFormat ? 'bg-accent text-surface-base' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        <div class="flex items-center gap-3">
          <Button variant="ghost" onClick={onReset}>
            Reset
          </Button>
          <Button variant="primary" onClick={onDownload} disabled={isExporting}>
            {isExporting ? 'Preparing download…' : 'Download'}
          </Button>
        </div>
      </div>

      {errorMessage && <p class="text-xs text-danger">{errorMessage}</p>}
    </div>
  );
}
