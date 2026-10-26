import { SOFT_HOLIDAYS } from "@/lib/holidays";

export type AttRow = { jenis: string; tanggal: string };

export type AlpaItem = { tanggal: string; hari: number; keterangan: string };

const WARNING_JENIS = new Set(["peringatan", "sp1", "sp2", "sp3"]);

function hasWarning(set: Set<string>): boolean {
  for (const j of set) if (WARNING_JENIS.has(j)) return true;
  return false;
}

/** Keterangan ALPA sesuai jenis peringatan/SP yang dipilih admin */
const WARNING_KETERANGAN: Record<string, string> = {
  peringatan: "ALPA - Peringatan",
  sp1: "ALPA - SP-1",
  sp2: "ALPA - SP-2",
  sp3: "ALPA - SP-3",
};

function warningKeterangan(set: Set<string>): string {
  // Prioritas terparah dulu bila lebih dari satu jenis tercatat di hari yang sama.
  for (const j of ["sp3", "sp2", "sp1", "peringatan"]) {
    if (set.has(j)) return WARNING_KETERANGAN[j];
  }
  return "ALPA - Peringatan";
}

/**
 * Hitung total hari ALPA pada rentang [start, end] (inklusif).
 * - Tidak ada catatan apapun di hari kerja → 1 hari ALPA ("Tidak absen")
 * - Hanya masuk (atau hanya pulang), tanpa izin/sakit → 0,5 hari ALPA
 *   (siswa hadir setengah hari — kehilangan separuh hari)
 * - Masuk + pulang → 0 (1 hari hadir penuh)
 * - Izin / sakit → 0 (tidak dihitung alpa)
 * - Peringatan / SP → 1 hari ALPA
 * - Hari libur / tidak kerja → dilewati
 *
 * @param byDate peta tanggal → kumpulan jenis absen untuk siswa tersebut
 * @param start   tanggal awal (YYYY-MM-DD), biasanya awal magang atau filter dari
 * @param end     tanggal akhir (YYYY-MM-DD), biasanya hari ini atau filter sampai
 */
export function hitungAlpa(
  byDate: Map<string, Set<string>>,
  isLibur: (ymd: string) => boolean,
  start: string,
  end: string,
): { total: number; items: AlpaItem[] } {
  const items: AlpaItem[] = [];
  if (!start || !end || start > end) return { total: 0, items };
  const d = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (d <= endD) {
    const ymd = d.toISOString().slice(0, 10);
    if (!isLibur(ymd)) {
      const set = byDate.get(ymd);
      if (!set || set.size === 0) {
        // Libur bersyarat: tanpa catatan absen sama sekali → dianggap libur
        if (!SOFT_HOLIDAYS.includes(ymd)) {
          items.push({ tanggal: ymd, hari: 1, keterangan: "Tidak absen sehari penuh" });
        }
      } else if (hasWarning(set)) {
        items.push({ tanggal: ymd, hari: 1, keterangan: warningKeterangan(set) });
      } else if (set.has("izin") || set.has("sakit")) {
        // izin/sakit → tidak dihitung alpa
      } else if (set.has("masuk") && set.has("pulang")) {
        // hadir penuh → bukan alpa
      } else if (set.has("masuk")) {
        items.push({ tanggal: ymd, hari: 0.5, keterangan: "Tidak absen pulang" });
      } else if (set.has("pulang")) {
        items.push({ tanggal: ymd, hari: 0.5, keterangan: "Tidak absen masuk" });
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const total = items.reduce((s, it) => s + it.hari, 0);
  return { total, items };
}

/**
 * Hitung skor kehadiran per hari:
 * - masuk + pulang  = 1 hari
 * - hanya masuk     = 0,5 hari
 * - izin / sakit    = 0 (tidak dihitung hadir)
 * - peringatan / SP = 0 hadir dan tetap masuk penyebut
 *
 * Penyebut = jumlah hari unik yang memiliki catatan absensi, termasuk
 * hari peringatan/SP agar status tersebut menurunkan persentase kehadiran.
 */
export function hitungKehadiran(
  rows: AttRow[],
  isLibur?: (ymd: string) => boolean,
): {
  hadir: number;
  totalHari: number;
  persen: number;
} {
  const byDate = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.tanggal) continue;
    // Hari yang ditandai libur (hari tidak kerja siswa) tidak dihitung.
    if (isLibur?.(r.tanggal)) continue;
    if (!byDate.has(r.tanggal)) byDate.set(r.tanggal, new Set());
    byDate.get(r.tanggal)!.add(r.jenis);
  }
  let hadir = 0;
  let totalHari = 0;
  for (const set of byDate.values()) {
    totalHari++;
    // Peringatan/SP selalu bernilai 0 hadir meskipun ada jenis lain pada hari yang sama.
    if (hasWarning(set)) continue;
    if (set.has("masuk") && set.has("pulang")) hadir += 1;
    else if (set.has("masuk")) hadir += 0.5;
  }
  const persen = totalHari > 0 ? (hadir / totalHari) * 100 : 0;
  return { hadir, totalHari, persen };
}

export function formatPersen(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

export function formatHari(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(".", ",");
}