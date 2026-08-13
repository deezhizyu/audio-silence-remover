export interface SilenceRun {
  isSilent: boolean;
  /** Inclusive start index into the envelope's window array. */
  startWindowIndex: number;
  /** Exclusive end index into the envelope's window array. */
  endWindowIndex: number;
}

export function runLengthEncodeSilence(isSilentPerWindow: boolean[]): SilenceRun[] {
  const runs: SilenceRun[] = [];

  let runStartIndex = 0;
  for (let index = 1; index <= isSilentPerWindow.length; index++) {
    const runEnded = index === isSilentPerWindow.length || isSilentPerWindow[index] !== isSilentPerWindow[runStartIndex];
    if (runEnded) {
      runs.push({
        isSilent: isSilentPerWindow[runStartIndex],
        startWindowIndex: runStartIndex,
        endWindowIndex: index,
      });
      runStartIndex = index;
    }
  }

  return runs;
}

export function silenceRunDurationSeconds(run: SilenceRun, windowSizeSeconds: number): number {
  return (run.endWindowIndex - run.startWindowIndex) * windowSizeSeconds;
}
