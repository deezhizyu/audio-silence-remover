export function formatSecondsLabel(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

export function formatPercentLabel(percent: number): string {
  return `${Math.round(percent)}%`;
}

export function formatDurationClock(seconds: number): string {
  const totalWholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalWholeSeconds / 60);
  const remainingSeconds = totalWholeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
