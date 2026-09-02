import { decideOutputContainerFormat } from './decideOutputContainerFormat';

export function deriveAlignedVideoFileName(originalFileName: string): string {
  const containerFormat = decideOutputContainerFormat(originalFileName);
  const baseName = originalFileName.replace(/\.[^./\\]+$/, '');
  return `${baseName}-aligned.${containerFormat}`;
}
