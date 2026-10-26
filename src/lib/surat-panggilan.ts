import JSZip from "jszip";

export type DataSuratPanggilan = {
  nama: string;
  kelas: string;
  tempatMagang: string;
};

export type OpsiSuratPanggilan = {
  /** Tanggal surat keluar (ISO yyyy-mm-dd) — dicetak pada "Kotabaru, ..." */
  tanggalSurat: string;
  /** Tanggal siswa dipanggil ke sekolah (ISO yyyy-mm-dd) — dicetak pada "Hari/Tanggal: ..." */
  tanggalPanggilan: string;
};

type JenisSurat = "ortu" | "dudi";

function fmtISO(iso: string, opts: Intl.DateTimeFormatOptions) {
  // Parse tanggal lokal (tanpa offset) supaya zona WITA tidak menggeser tanggal.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 4, 0, 0));
  return new Intl.DateTimeFormat("id-ID", { ...opts, timeZone: "Asia/Makassar" }).format(date);
}

function rincianKelas(kelas: string) {
  const parts = kelas.trim().split(/\s+/).filter(Boolean);
  const romawi = parts[0] && /^X{1,2}I{0,2}$/i.test(parts[0]);
  return {
    tingkat: romawi ? parts[0].toUpperCase() : kelas,
    jurusan: romawi && parts.length > 1 ? parts.slice(1).join(" ") : kelas,
  };
}

function escapeXml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeFilename(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "siswa";
}

/** Fills the official school template (public/templates) client-side; layout stays identical. */
export async function unduhSuratPanggilan(jenis: JenisSurat, data: DataSuratPanggilan, opsi: OpsiSuratPanggilan) {
  const res = await fetch(jenis === "ortu" ? "/templates/surat-Ortu.docx" : "/templates/surat-DUDI.docx");
  if (!res.ok) throw new Error("Template surat tidak dapat dimuat.");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Template surat rusak.");

  const kelas = data.kelas || "-";
  const { tingkat, jurusan } = rincianKelas(kelas);
  const values: Record<string, string> = {
    "[tanggal hari ini]": fmtISO(opsi.tanggalSurat, { day: "numeric", month: "long", year: "numeric" }),
    "[Hari, Tanggal Bulan Tahun]": fmtISO(opsi.tanggalPanggilan, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    "[Nama Siswa]": data.nama || "-",
    "[Kelas]": kelas,
    "[Tempat Magang]": data.tempatMagang || "-",
    "[Tingkat]": tingkat,
    "[Jurusan]": jurusan,
  };
  let xml = await file.async("string");
  for (const [key, val] of Object.entries(values)) xml = xml.split(key).join(escapeXml(val));
  zip.file("word/document.xml", xml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${jenis === "ortu" ? "Surat-Panggilan-Ortu" : "Surat-Izin-DUDI"}-${safeFilename(data.nama)}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
