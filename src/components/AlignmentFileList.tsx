import { alignmentFileRows, matchedPairs, removeSelectedAlignmentFile, setSelectedAlignmentFiles } from '../state/audioAlignmentSignals';
import { Button } from './ui/Button';
import { SectionHeading } from './ui/SectionHeading';

function VideoFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-4 w-4 shrink-0 text-text-tertiary">
      <rect x="2.5" y="5.5" width="13" height="13" rx="2" />
      <path d="M15.5 10.2 21 7.5v9l-5.5-2.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function AudioFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0 text-text-tertiary">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function RemoveFileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" class="h-3 w-3">
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

function FileCell({ file, kind }: { file: File | null; kind: 'video' | 'audio' }) {
  if (!file) return <span class="text-text-tertiary/50">—</span>;
  return (
    <span class="flex min-w-0 items-center gap-2">
      {kind === 'video' ? <VideoFileIcon /> : <AudioFileIcon />}
      <span class="truncate text-text-primary">{file.name}</span>
      <button
        type="button"
        onClick={() => removeSelectedAlignmentFile(file)}
        aria-label={`Remove ${file.name}`}
        class="ml-auto shrink-0 rounded p-1 text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-danger"
      >
        <RemoveFileIcon />
      </button>
    </span>
  );
}

function handleClearAll(): void {
  setSelectedAlignmentFiles([]);
}

/** The merged video/audio file list: one connected box (a single stroke down the middle, like the two
    drop zones it replaces) with matched pairs on the same row, highlighted so a match reads at a glance.
    Each file can be removed on its own, or the whole selection cleared at once. */
export function AlignmentFileList() {
  const rows = alignmentFileRows.value;
  if (rows.length === 0) return null;

  const pairCount = matchedPairs.value.length;

  const rowCells = rows.flatMap(row => [
    <div key={`${row.key}-video`} class={`border-r border-t border-border-subtle px-4 py-2.5 text-xs ${row.isMatched ? 'bg-emerald-500/10' : ''}`}>
      <FileCell file={row.videoFile} kind="video" />
    </div>,
    <div key={`${row.key}-audio`} class={`border-t border-border-subtle px-4 py-2.5 text-xs ${row.isMatched ? 'bg-emerald-500/10' : ''}`}>
      <FileCell file={row.audioFile} kind="audio" />
    </div>,
  ]);

  return (
    <div class="overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
      <div class="flex items-start justify-between gap-3 p-5 pb-4">
        <SectionHeading
          title={`Files — ${pairCount} pair${pairCount === 1 ? '' : 's'} matched`}
          description="A single pair works with any filenames. Matching more than one pair requires identical filenames (ignoring the extension)."
        />
        <Button variant="ghost" onClick={handleClearAll}>
          Clear
        </Button>
      </div>
      <div class="grid grid-cols-2 border-t border-border-subtle">
        <div class="border-r border-border-subtle px-4 py-2 text-xs font-medium text-text-secondary">Video</div>
        <div class="px-4 py-2 text-xs font-medium text-text-secondary">Voice-changed audio</div>
        {rowCells}
      </div>
    </div>
  );
}
