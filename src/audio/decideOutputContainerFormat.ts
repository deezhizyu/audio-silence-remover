export type VideoContainerFormat = 'mp4' | 'mov';

export function decideOutputContainerFormat(originalFileName: string): VideoContainerFormat {
  return /\.mov$/i.test(originalFileName) ? 'mov' : 'mp4';
}
