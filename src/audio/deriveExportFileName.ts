import type { ExportAudioFormat } from './types';

export function deriveExportFileName(originalFileName: string, format: ExportAudioFormat): string {
  const baseName = originalFileName.replace(/\.[^./\\]+$/, '');
  return `${baseName}-silence-removed.${format}`;
}
