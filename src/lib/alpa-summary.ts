import { makeIsLibur } from "@/lib/libur";
import { hitungAlpa } from "@/lib/kehadiran";

export type AttendanceRow = { user_id: string; jenis: string; tanggal: string };

export type SiswaProfile = {
  id: string;
  nama_siswa?: string | null;
  kelas?: string | null;
  tempat_magang?: string | null;
  no_hp_guru?: string | null;
};

export type AlpaOverride = {
  hari_aktif: number[] | null;
  tanggal_libur?: string[] | null;
};

export type AlpaRow = {
  id: string;
  nama: string;
  kelas: string;
  tempat: string;
  guruPhone: string | null;
  total: number;
};

export const PAGE_SIZE = 1000;

/**
 * Ambil seluruh baris absensi lewat paginasi.
 * PostgREST membatasi 1000 baris per permintaan, jadi halaman harus diambil
 * berulang sampai halaman terakhir (jumlah baris < pageSize).
 */
export async function fetchAllPaged<T>(
  getPage: (from: number, to: number) => Promise<T[]>,
  pageSize = PAGE_SIZE,
  maxPages = 100,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const chunk = await getPage(page * pageSize, page * pageSize + pageSize - 1);
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

/** Kelompokkan baris absensi menjadi peta user → tanggal → jenis */
export function groupByUser(rows: AttendanceRow[]): Map<string, Map<string, Set<string>>> {
  const byUser = new Map<string, Map<string, Set<string>>>();
  for (const a of rows) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, new Map());
    const m = byUser.get(a.user_id)!;
    if (!m.has(a.tanggal)) m.set(a.tanggal, new Set());
    m.get(a.tanggal)!.add(a.jenis);
  }
  return byUser;
}

/**
 * Hitung baris rekap ALPA per siswa.
 * - Siswa tanpa catatan absensi sama sekali dilewati (belum mulai PKL).
 * - Perhitungan dimulai dari absen pertama siswa bila lebih baru dari `mulai`.
 */
export function buildAlpaRows(opts: {
  profiles: SiswaProfile[];
  attendance: AttendanceRow[];
  overrides: Map<string, AlpaOverride>;
  globalHari: number[];
  mulai: string;
  sampai: string;
  normalizePhone: (raw: string | null | undefined) => string | null;
}): AlpaRow[] {
  const byUser = groupByUser(opts.attendance);
  const rows: AlpaRow[] = [];
  for (const p of opts.profiles) {
    const ov = opts.overrides.get(p.id);
    const isLibur = makeIsLibur(
      { hari_aktif: ov?.hari_aktif ?? null, tanggal_libur: ov?.tanggal_libur ?? [] },
      opts.globalHari,
    );
    const byDate = byUser.get(p.id);
    if (!byDate || byDate.size === 0) continue;
    const awal = Array.from(byDate.keys()).sort()[0]!;
    const start = awal > opts.mulai ? awal : opts.mulai;
    const { total } = hitungAlpa(byDate, isLibur, start, opts.sampai);
    if (total <= 0) continue;
    rows.push({
      id: p.id,
      nama: p.nama_siswa ?? "(tanpa nama)",
      kelas: p.kelas ?? "-",
      tempat: p.tempat_magang ?? "-",
      guruPhone: opts.normalizePhone(p.no_hp_guru),
      total,
    });
  }
  rows.sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));
  return rows;
}
