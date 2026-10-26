import templateAsset from "@/assets/sertifikat-template-v2.jpg.asset.json";

export const SERTIFIKAT_MIN_PERSEN = 95;

/** Sertifikat baru boleh diunduh mulai 5 Februari 2027 (WITA / UTC+8). */
export const SERTIFIKAT_RILIS = new Date("2027-02-05T00:00:00+08:00");
export const SERTIFIKAT_RILIS_LABEL = "5 Februari 2027";

export function sertifikatSudahRilis(now: Date = new Date()): boolean {
  return now.getTime() >= SERTIFIKAT_RILIS.getTime();
}

export type SertifikatInput = {
  nama: string;
  kelas: string;
  persen: number;
  tempat?: string;
};

const NAVY = "#0b2a4a";
const BG = "#fcfbf9";
const BADGE = "#062748";
const BADGE_TEXT = "#ffffff";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  build: (size: number) => string,
) {
  let size = startSize;
  ctx.font = build(size);
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 1;
    ctx.font = build(size);
  }
}

export async function buatSertifikat(
  input: SertifikatInput,
  opts?: { watermark?: boolean },
): Promise<Blob> {
  try {
    await (document as any).fonts?.load?.("70px 'Monotype Corsiva'");
    await (document as any).fonts?.load?.("70px 'Allura'");
    await (document as any).fonts?.ready;
  } catch {
    /* abaikan */
  }

  const img = await loadImage(templateAsset.url);
  const canvas = document.createElement("canvas");
  canvas.width = img.width; // 1484
  canvas.height = img.height; // 1060
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const CX = 745;

  // --- Nama siswa (menimpa placeholder [Nama Siswa]) ---
  ctx.fillStyle = BG;
  ctx.fillRect(420, 418, 660, 84);
  ctx.fillStyle = NAVY;
  fitFont(ctx, input.nama, 600, 80, (s) => `${s}px 'Monotype Corsiva', 'Allura', cursive`);
  ctx.fillText(input.nama, CX, 462);

  // --- Kelas ---
  ctx.fillStyle = BG;
  ctx.fillRect(500, 524, 490, 36);
  ctx.fillStyle = NAVY;
  fitFont(ctx, input.kelas, 420, 28, (s) => `500 ${s}px 'Plus Jakarta Sans', system-ui, sans-serif`);
  ctx.fillText(input.kelas, CX, 542);

  // --- Baris tempat magang ---
  const tempat = (input.tempat ?? "").trim();
  const barisTempat = `Praktik Kerja Lapangan (PKL) di ${tempat || "-"}`;
  ctx.fillStyle = BG;
  ctx.fillRect(300, 596, 890, 30);
  ctx.fillStyle = NAVY;
  fitFont(ctx, barisTempat, 840, 25, (s) => `400 ${s}px 'Plus Jakarta Sans', system-ui, sans-serif`);
  ctx.fillText(barisTempat, CX, 611);

  // --- Persentase kehadiran (di dalam badge navy) ---
  const persenText = `${input.persen.toFixed(1).replace(".", ",")}%`;
  ctx.fillStyle = BADGE;
  ctx.fillRect(586, 668, 320, 70);
  ctx.fillStyle = BADGE_TEXT;
  fitFont(ctx, persenText, 300, 56, (s) => `600 ${s}px 'Plus Jakarta Sans', system-ui, sans-serif`);
  ctx.fillText(persenText, CX, 702);

  // Watermark DRAFT besar menyilang (hanya untuk pratinjau)
  if (opts?.watermark) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.font = "bold 140px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(200, 50, 50, 0.18)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DRAFT", 0, 0);
    ctx.restore();
  }

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
}

export async function unduhSertifikat(input: SertifikatInput) {
  const blob = await buatSertifikat(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sertifikat-${input.nama.replace(/\s+/g, "-").toLowerCase()}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
