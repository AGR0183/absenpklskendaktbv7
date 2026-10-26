import * as XLSX from "xlsx";
import { SOFT_HOLIDAYS } from "@/lib/holidays";

type Profile = {
  id: string;
  nama_siswa: string | null;
  kelas: string | null;
  tempat_magang: string | null;
};

type Att = {
  user_id: string;
  jenis: string;
  tanggal: string;
};

const DAY_NAMES = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUM'AT", "SABTU"];
const MONTH_NAMES = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function todayYMD(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function exportRekapMatriks(opts: {
  rows: Att[];
  profiles: Map<string, Profile>;
  from: string;
  to: string;
  /** Tandai hari sebagai LIBUR (mis. hari tidak kerja siswa) */
  isLibur?: (userId: string, ymd: string) => boolean;
}) {
  const { rows, profiles, from, to, isLibur } = opts;

  // Tentukan rentang tanggal
  let dateFrom = from;
  let dateTo = to || todayYMD();
  if (!dateFrom) {
    const dates = rows.map((r) => r.tanggal).filter(Boolean).sort();
    dateFrom = dates[0] ?? dateTo;
  }
  if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];

  // Bangun list tanggal
  const dates: Date[] = [];
  for (let d = parseYMD(dateFrom); fmtYMD(d) <= dateTo; d = addDays(d, 1)) {
    dates.push(new Date(d));
  }

  // Group index tanggal per bulan (YYYY-MM)
  const monthBuckets: { key: string; label: string; idxs: number[] }[] = [];
  dates.forEach((d, i) => {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let bucket = monthBuckets[monthBuckets.length - 1];
    if (!bucket || bucket.key !== key) {
      bucket = {
        key,
        label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
        idxs: [],
      };
      monthBuckets.push(bucket);
    }
    bucket.idxs.push(i);
  });

  // Daftar siswa: urut berdasarkan nama tempat magang, lalu nama siswa.
  const siswaList = Array.from(profiles.values()).sort((a, b) => {
    const t = (a.tempat_magang ?? "").localeCompare(b.tempat_magang ?? "");
    if (t !== 0) return t;
    return (a.nama_siswa ?? "").localeCompare(b.nama_siswa ?? "");
  });

  // Per (user,tanggal) lacak masuk/pulang/izin/sakit/peringatan/SP
  type DayFlags = {
    masuk: boolean;
    pulang: boolean;
    izin: boolean;
    sakit: boolean;
    warning: string | null;
  };
  const WARNING_LABEL: Record<string, string> = {
    peringatan: "ALPA-PERINGATAN",
    sp1: "ALPA-SP1",
    sp2: "ALPA-SP2",
    sp3: "ALPA-SP3",
  };
  const dayMap = new Map<string, Map<string, DayFlags>>();
  for (const r of rows) {
    if (!dayMap.has(r.user_id)) dayMap.set(r.user_id, new Map());
    const m = dayMap.get(r.user_id)!;
    if (!m.has(r.tanggal)) m.set(r.tanggal, { masuk: false, pulang: false, izin: false, sakit: false, warning: null });
    const f = m.get(r.tanggal)!;
    if (r.jenis === "masuk") f.masuk = true;
    else if (r.jenis === "pulang") f.pulang = true;
    else if (r.jenis === "izin") f.izin = true;
    else if (r.jenis === "sakit") f.sakit = true;
    else if (WARNING_LABEL[r.jenis]) f.warning = WARNING_LABEL[r.jenis];
  }

  // status cell: number 1 / 0.5 untuk hadir; string SAKIT/IZIN/ALPA/LIBUR/ALPA-PERINGATAN/ALPA-SP1/ALPA-SP2/ALPA-SP3/"" lainnya
  function cellFor(uid: string, ymd: string, d: Date): number | string {
    const f = dayMap.get(uid)?.get(ymd);
    if (f) {
      if (f.warning) return f.warning;
      if (f.masuk && f.pulang) return 1;
      if (f.masuk || f.pulang) return 0.5;
      if (f.izin) return "IZIN";
      if (f.sakit) return "SAKIT";
    }
    if (d.getUTCDay() === 0) return "LIBUR";
    if (isLibur?.(uid, ymd)) return "LIBUR";
    if (SOFT_HOLIDAYS.includes(ymd)) return "LIBUR";
    if (ymd <= today) return "ALPA";
    return "";
  }

  const today = todayYMD();

  // ---- Bangun AOA ----
  // Layout kolom:
  // 0: No. | 1: Nama Iduka | 2: KK | 3: NAMA SISWA
  // 4..8: JUMLAH TOTAL (HADIR/SAKIT/IZIN/ALPA/% HADIR)
  // lalu per bulan: N hari + 5 ringkasan
  const FIXED = 9;
  const totalCols =
    FIXED + monthBuckets.reduce((s, b) => s + b.idxs.length + 5, 0);

  const row1: (string | number | null)[] = new Array(totalCols).fill(null);
  const row2: (string | number | null)[] = new Array(totalCols).fill(null);
  const row3: (string | number | null)[] = new Array(totalCols).fill(null);

  // Header tetap (row1 = label besar, row2 = day name / sub-header, row3 = tanggal)
  row1[0] = "No.";
  row1[1] = "Nama Iduka";
  row1[2] = "KK";
  row1[3] = "NAMA SISWA";
  row1[4] = "JUMLAH TOTAL";
  row2[4] = "HADIR";
  row2[5] = "SAKIT";
  row2[6] = "IZIN";
  row2[7] = "ALPA";
  row2[8] = "% HADIR";

  let cursor = FIXED;
  const monthMeta: { startCol: number; nDays: number; sumStart: number }[] = [];
  for (const b of monthBuckets) {
    const startCol = cursor;
    row1[startCol] = b.label;
    for (let k = 0; k < b.idxs.length; k++) {
      const d = dates[b.idxs[k]];
      row2[startCol + k] = DAY_NAMES[d.getUTCDay()];
      row3[startCol + k] = d.getUTCDate();
    }
    const sumStart = startCol + b.idxs.length;
    row1[sumStart] = "JUMLAH";
    row2[sumStart] = "HADIR";
    row2[sumStart + 1] = "SAKIT";
    row2[sumStart + 2] = "IZIN";
    row2[sumStart + 3] = "ALPA";
    row2[sumStart + 4] = "% HADIR";
    monthMeta.push({ startCol, nDays: b.idxs.length, sumStart });
    cursor = sumStart + 5;
  }

  const aoa: (string | number | null)[][] = [row1, row2, row3];

  // Baris data
  siswaList.forEach((p, i) => {
    const row: (string | number | null)[] = new Array(totalCols).fill(null);
    row[0] = i + 1;
    row[1] = p.tempat_magang ?? "";
    row[2] = p.kelas ?? "";
    row[3] = p.nama_siswa ?? "";

    let col = FIXED;
    let tHadir = 0, tSakit = 0, tIzin = 0, tAlpa = 0;
    for (const b of monthBuckets) {
      let mHadir = 0, mSakit = 0, mIzin = 0, mAlpa = 0;
      for (const di of b.idxs) {
        const d = dates[di];
        const ymd = fmtYMD(d);
        const v = cellFor(p.id, ymd, d);
        if (typeof v === "number") {
          mHadir += v;
          // setengah hari hadir (hanya masuk atau hanya pulang) → 0,5 hari alpa
          if (v < 1) mAlpa += 0.5;
        } else if (v === "SAKIT") mSakit++;
        else if (v === "IZIN") mIzin++;
        else if (v === "ALPA" || (typeof v === "string" && v.startsWith("ALPA-"))) mAlpa++;
        row[col++] = v;
      }
      // ringkasan per bulan (nilai dihitung langsung)
      row[col++] = mHadir;
      row[col++] = mSakit;
      row[col++] = mIzin;
      row[col++] = mAlpa;
      const mEfektif = mHadir + mSakit + mIzin + mAlpa;
      row[col++] = mEfektif > 0 ? mHadir / mEfektif : 0;
      tHadir += mHadir; tSakit += mSakit; tIzin += mIzin; tAlpa += mAlpa;
    }

    // total seluruh rentang (nilai dihitung langsung)
    row[4] = tHadir;
    row[5] = tSakit;
    row[6] = tIzin;
    row[7] = tAlpa;
    const tEfektif = tHadir + tSakit + tIzin + tAlpa;
    row[8] = tEfektif > 0 ? tHadir / tEfektif : 0;

    aoa.push(row);
  });

  // ---- Bangun worksheet manual agar formula bisa diset ----
  const ws: XLSX.WorkSheet = {};
  const persenCols = new Set<number>([8, ...monthMeta.map((m) => m.sumStart + 4)]);
  const range = { s: { c: 0, r: 0 }, e: { c: totalCols - 1, r: aoa.length - 1 } };
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < totalCols; c++) {
      const v = aoa[r][c];
      if (v === null || v === undefined || v === "") continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      if (typeof v === "object" && v !== null && "f" in (v as object)) {
        ws[addr] = { t: "n", f: (v as { f: string }).f };
      } else if (typeof v === "number") {
        ws[addr] = { t: "n", v };
        if (r >= 3 && persenCols.has(c)) ws[addr].z = "0.0%";
      } else {
        ws[addr] = { t: "s", v: String(v) };
      }
    }
  }
  ws["!ref"] = XLSX.utils.encode_range(range);

  // Merges untuk header bulan & JUMLAH TOTAL
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 4 }, e: { r: 0, c: 8 } }, // JUMLAH TOTAL
  ];
  for (const mm of monthMeta) {
    merges.push({ s: { r: 0, c: mm.startCol }, e: { r: 0, c: mm.startCol + mm.nDays - 1 } });
    merges.push({ s: { r: 0, c: mm.sumStart }, e: { r: 0, c: mm.sumStart + 4 } });
  }
  // Merge header tetap (No., Nama Iduka, KK, NAMA SISWA) vertikal row1-row2-row3
  for (let c = 0; c <= 3; c++) {
    merges.push({ s: { r: 0, c }, e: { r: 2, c } });
  }
  ws["!merges"] = merges;

  // Lebar kolom
  const cols: XLSX.ColInfo[] = [];
  cols[0] = { wch: 4 };
  cols[1] = { wch: 28 };
  cols[2] = { wch: 8 };
  cols[3] = { wch: 24 };
  for (let c = 4; c < totalCols; c++) cols[c] = { wch: 7 };
  ws["!cols"] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap");
  const stamp = todayYMD();
  XLSX.writeFile(wb, `rekap-pkl-${stamp}.xlsx`);
}