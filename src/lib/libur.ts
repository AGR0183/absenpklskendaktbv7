import { HOLIDAYS, HOLIDAY_RANGES } from "@/lib/holidays";

export type JadwalKerja = {
  /** Hari kerja siswa (0=Min..6=Sab). null = ikut pengaturan sekolah */
  hari_aktif: number[] | null;
  /** Tanggal libur pribadi/kantor (YYYY-MM-DD) */
  tanggal_libur: string[];
};

export const DEFAULT_HARI_AKTIF = [1, 2, 3, 4, 5, 6];

function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/**
 * Buat fungsi pengecek libur untuk seorang siswa.
 * Hari dianggap LIBUR bila: bukan hari kerja siswa, masuk tanggal libur siswa,
 * atau termasuk libur nasional bawaan sistem.
 */
export function makeIsLibur(
  jadwal: JadwalKerja | null | undefined,
  globalHariAktif: number[] = DEFAULT_HARI_AKTIF,
): (ymd: string) => boolean {
  const hari =
    jadwal?.hari_aktif && jadwal.hari_aktif.length > 0 ? jadwal.hari_aktif : globalHariAktif;
  const libur = new Set([...(jadwal?.tanggal_libur ?? []), ...HOLIDAYS]);
  return (ymd: string) => {
    if (!ymd) return false;
    if (libur.has(ymd)) return true;
    for (const r of HOLIDAY_RANGES) {
      if (ymd >= r.mulai && ymd <= r.sampai) return true;
    }
    return !hari.includes(dowOf(ymd));
  };
}
