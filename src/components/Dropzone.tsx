import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Button } from './ui/Button';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  heading?: string;
  subtext?: string;
}

export function Dropzone({
  onFileSelected,
  disabled = false,
  accept = 'audio/*',
  heading = 'Drop an audio file here',
  subtext = 'or choose a file — everything runs on this device, nothing is uploaded',
}: DropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (event: JSX.TargetedDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDraggingOver(true);
  };

  const handleDrop = (event: JSX.TargetedDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;

    const droppedFile = event.dataTransfer?.files?.[0];
    if (droppedFile) onFileSelected(droppedFile);
  };

  const handleFileInputChange = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.[0];
    if (selectedFile) onFileSelected(selectedFile);
    event.currentTarget.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      class={`dropzone group flex flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed px-8 py-24 text-center ${
        isDraggingOver ? 'is-drag-active' : ''
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-surface-overlay text-accent transition-colors duration-300 group-hover:bg-accent/15">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class={`h-6 w-6 ${isDraggingOver ? '-translate-y-0.5' : 'group-hover:[animation:float-icon_1.8s_ease-in-out_infinite]'}`}
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </div>

      <div>
        <p class="text-sm font-medium text-text-primary">{heading}</p>
        <p class="mt-1 text-xs text-text-tertiary">{subtext}</p>
      </div>

      <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
        Choose file
      </Button>
      <input ref={fileInputRef} type="file" accept={accept} class="hidden" onChange={handleFileInputChange} disabled={disabled} />
    </div>
  );
}
