export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-gesture' | 'failed';

export function canShareFiles(file?: File): boolean {
  try {
    const probe = file ?? new File([new Blob(['x'], { type: 'application/pdf' })], 'probe.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Share via the Web Share API (on iPhone: Save to Files, Mail, AirDrop…),
 * falling back to a download. Must be called from a user gesture; if the
 * gesture expired while rendering, returns 'needs-gesture' so the UI can ask
 * for one more tap.
 */
export async function shareOrDownload(file: File): Promise<ShareOutcome> {
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-gesture';
      // Fall through to download.
    }
  }
  return download(file) ? 'downloaded' : 'failed';
}

export function download(file: File): boolean {
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    return false;
  }
}
