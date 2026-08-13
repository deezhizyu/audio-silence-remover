/** Revoked on a delay rather than immediately after `.click()`, since some browsers read the
    blob URL asynchronously when starting a large download — revoking too early can abort it. */
const OBJECT_URL_REVOKE_DELAY_MILLISECONDS = 1000;

export function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MILLISECONDS);
}
