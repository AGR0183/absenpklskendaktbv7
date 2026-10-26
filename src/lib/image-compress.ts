/**
 * Kompresi foto absensi di sisi perangkat sebelum diunggah.
 *
 * Tujuan: menekan ukuran file kamera (biasanya 2–6 MB) menjadi sekitar
 * 100–300 KB tanpa mengorbankan kejelasan wajah/lokasi untuk verifikasi.
 */

export type CompressOptions = {
  /** Sisi terpanjang maksimum (px). */
  maxSide?: number;
  /** Target ukuran akhir (byte). */
  targetBytes?: number;
  /** Kualitas awal (0–1). */
  quality?: number;
};

const DEFAULTS: Required<CompressOptions> = {
  maxSide: 1280,
  targetBytes: 300 * 1024,
  quality: 0.82,
};

async function loadImage(blob: Blob): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fallback ke <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca foto"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal mengompresi foto"))), type, quality),
  );
}

/**
 * Membaca file kamera, mengecilkan resolusi, lalu mengompresi sampai
 * mendekati target ukuran. Mengembalikan satu file final siap unggah.
 */
export async function compressAttendancePhoto(
  input: Blob,
  options: CompressOptions = {},
): Promise<Blob> {
  const { maxSide, targetBytes, quality } = { ...DEFAULTS, ...options };

  // File sudah kecil: tidak perlu diproses ulang.
  if (input.size <= targetBytes / 2) return input;

  let img: HTMLImageElement | ImageBitmap;
  try {
    img = await loadImage(input);
  } catch {
    return input; // jangan sampai absensi gagal hanya karena kompresi
  }

  const w0 = "width" in img ? img.width : 0;
  const h0 = "height" in img ? img.height : 0;
  if (!w0 || !h0) return input;

  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return input;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
  if ("close" in img && typeof img.close === "function") img.close();

  let q = quality;
  let out: Blob;
  try {
    out = await canvasToBlob(canvas, "image/jpeg", q);
    // Turunkan kualitas bertahap sampai mendekati target.
    while (out.size > targetBytes && q > 0.45) {
      q -= 0.1;
      out = await canvasToBlob(canvas, "image/jpeg", q);
    }
  } catch {
    return input;
  }

  return out.size < input.size ? out : input;
}
