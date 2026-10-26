const DEFAULT_MESSAGE = "Absensi PKL";

export type PhotoShareResult = "shared" | "downloaded" | "unsupported" | "cancelled";

export function buildWhatsAppTextUrl(text: string): string {
  const message = text.trim() || DEFAULT_MESSAGE;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export async function copyTextSafely(text: string): Promise<void> {
  const message = text.trim();
  if (!message || typeof navigator === "undefined" || !navigator.clipboard) return;

  try {
    await navigator.clipboard.writeText(message);
  } catch {
    // Clipboard is only a backup; ignore failures so sharing still works.
  }
}

export function openWhatsAppText(text: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(buildWhatsAppTextUrl(text));
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sharePhotoToWhatsApp(options: {
  blob?: Blob | null;
  url?: string | null;
  filename: string;
  text?: string;
  title?: string;
  downloadWhenUnsupported?: boolean;
}): Promise<PhotoShareResult> {
  if (typeof navigator === "undefined") return "unsupported";

  const photoBlob = options.blob ?? (options.url ? await fetch(options.url).then((r) => {
    if (!r.ok) throw new Error("Foto tidak bisa diambil");
    return r.blob();
  }) : null);
  if (!photoBlob) throw new Error("Foto tidak tersedia");

  const file = new File([photoBlob], options.filename, { type: photoBlob.type || "image/jpeg" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  // IMPORTANT: only share files (no `text`/`url`). Some Android share targets
  // (including WhatsApp) drop the attachment when `text` is present and only
  // send the caption as a plain message. Copy the caption to clipboard so the
  // user can paste it manually after the photo is attached.
  const data: ShareData = { files: [file] };

  if (!nav.share || (nav.canShare && !nav.canShare(data))) {
    if (options.downloadWhenUnsupported) {
      downloadBlob(photoBlob, options.filename);
      return "downloaded";
    }
    return "unsupported";
  }

  if (options.text) {
    await copyTextSafely(options.text);
  }

  try {
    await nav.share(data);
    return "shared";
  } catch (error: any) {
    if (error?.name === "AbortError") return "cancelled";
    throw error;
  }
}