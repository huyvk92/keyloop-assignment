/**
 * Save text as a file in the browser: a Blob URL on a temporary `<a download>` that is clicked
 * and removed at once (ADR-010). The URL is revoked on the next task, once the browser has taken
 * the download, so the Blob's memory is released.
 */
export function downloadText(text: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
