import { formatJam, formatTanggal } from "./format";

export type OverlayInput = {
  imageBlob: Blob;
  jenis: "masuk" | "pulang";
  taken: Date;
  lat: number | null;
  lng: number | null;
  namaLokasi: string;
  namaSiswa: string;
  kelas: string;
  tempatMagang: string;
};

/**
 * Composes a 9:16 photo with bottom 1/3 timestamp/GPS overlay.
 * Returns a JPEG blob.
 */
export async function composePhoto(input: OverlayInput): Promise<Blob> {
  const img = await blobToImage(input.imageBlob);

  // Target 9:16 portrait — render at 720x1280 (storage-optimized).
  // Design math below is authored at 1080x1920, so we scale the context
  // to keep all coords/font sizes consistent while reducing pixel count by ~55%.
  const W = 720;
  const H = 1280;
  const DESIGN_W = 1080;
  const DESIGN_H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(W / DESIGN_W, H / DESIGN_H);

  // cover-fit source image (in design coords)
  drawCover(ctx, img, 0, 0, DESIGN_W, DESIGN_H);

  // ===== Bottom 1/4 overlay strip (design coords) =====
  const stripH = Math.floor(DESIGN_H / 4);
  const stripY = DESIGN_H - stripH;

  // Solid black backdrop with 70% opacity
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, stripY, DESIGN_W, stripH);

  // Accent bar on left
  ctx.fillStyle = input.jenis === "masuk" ? "#22c55e" : "#ef4444";
  ctx.fillRect(0, stripY, 14, stripH);

  // Jenis badge
  ctx.fillStyle = input.jenis === "masuk" ? "#22c55e" : "#ef4444";
  roundRect(ctx, 40, stripY + 30, 320, 64, 14);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(
    input.jenis === "masuk" ? "ABSEN MASUK" : "ABSEN PULANG",
    58,
    stripY + 62
  );

  // Right-side label
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 26px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("SMKN 2 Kotabaru", DESIGN_W - 40, stripY + 62);
  ctx.textAlign = "left";

  // Siswa info
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px 'Plus Jakarta Sans', system-ui, sans-serif";
  wrapText(ctx, input.namaSiswa, 40, stripY + 150, DESIGN_W - 80, 44, 1);

  ctx.font = "600 28px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  wrapText(
    ctx,
    `${input.kelas} • ${input.tempatMagang}`,
    40,
    stripY + 200,
    DESIGN_W - 80,
    32,
    1
  );

  // Date & time
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 46px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText(formatJam(input.taken), 40, stripY + 280);

  ctx.font = "500 26px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(formatTanggal(input.taken), 40, stripY + 325);

  // Coords
  ctx.font = "500 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const coordText =
    input.lat != null && input.lng != null
      ? `📍 ${input.lat.toFixed(6)}, ${input.lng.toFixed(6)}`
      : "📍 GPS tidak tersedia";
  ctx.fillText(coordText, 40, stripY + 375);

  // Location name (wrap)
  ctx.font = "600 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  wrapText(ctx, input.namaLokasi, 40, stripY + 415, DESIGN_W - 80, 30, 2);

  // Quality 0.72 keeps overlay text legible while shrinking JPEG to ~80–140 KB.
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.72)
  );
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const cr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
      lines++;
      if (lines >= maxLines - 1) {
        // last line, ellipsis if remaining
        let rest = words.slice(i).join(" ");
        while (ctx.measureText(rest + "…").width > maxWidth && rest.length > 0) {
          rest = rest.slice(0, -1);
        }
        ctx.fillText(rest + (i < words.length - 1 ? "…" : ""), x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}