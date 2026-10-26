/** Daftar tanggal libur nasional (YYYY-MM-DD, WITA) — tidak ada pengingat absen. */
export const HOLIDAYS: string[] = [
  "2026-08-17", // HUT RI
  "2026-08-25",
  "2026-12-24",
  "2026-12-25", // Natal
  "2027-01-01", // Tahun Baru
];

/**
 * Libur bersyarat: tanggal ini dianggap LIBUR hanya bagi siswa yang
 * tidak absen sama sekali. Siswa yang absen tetap dihitung normal.
 */
export const SOFT_HOLIDAYS: string[] = [
  "2026-08-08", // Sabtu
];

/**
 * Rentang libur penuh (inklusif, YYYY-MM-DD, WITA) — semua siswa tidak
 * dihitung ALPA pada rentang ini.
 */
export const HOLIDAY_RANGES: { mulai: string; sampai: string }[] = [
  { mulai: "2026-10-05", sampai: "2026-11-05" },
];
