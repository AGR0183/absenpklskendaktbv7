import { describe, expect, it } from "vitest";
import { buildAlpaRows, fetchAllPaged, groupByUser, PAGE_SIZE } from "@/lib/alpa-summary";
import type { AttendanceRow, SiswaProfile } from "@/lib/alpa-summary";
import { hitungAlpa, hitungKehadiran } from "@/lib/kehadiran";

const HARI_GLOBAL = [1, 2, 3, 4, 5, 6]; // Senin–Sabtu
const noop = (raw: string | null | undefined) => (raw ? String(raw) : null);

function hadirPenuh(userId: string, tanggal: string[]): AttendanceRow[] {
  return tanggal.flatMap((t) => [
    { user_id: userId, jenis: "masuk", tanggal: t },
    { user_id: userId, jenis: "pulang", tanggal: t },
  ]);
}

/** Semua hari kerja (Senin–Sabtu) pada rentang inklusif */
function hariKerja(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (d <= e) {
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const profil = (id: string, nama: string): SiswaProfile => ({
  id,
  nama_siswa: nama,
  kelas: "XII TKR",
  tempat_magang: "Bengkel Ayung",
  no_hp_guru: "628111",
});

describe("fetchAllPaged (batas 1000 baris)", () => {
  it("mengambil semua halaman sampai halaman terakhir tidak penuh", async () => {
    const total = 2350;
    const source = Array.from({ length: total }, (_, i) => i);
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllPaged<number>(async (from, to) => {
      calls.push([from, to]);
      return source.slice(from, to + 1);
    });
    expect(rows).toHaveLength(total);
    expect(rows[total - 1]).toBe(total - 1);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("berhenti setelah satu halaman bila data kurang dari page size", async () => {
    let calls = 0;
    const rows = await fetchAllPaged<number>(async () => {
      calls++;
      return [1, 2, 3];
    });
    expect(rows).toHaveLength(3);
    expect(calls).toBe(1);
  });

  it("mengambil halaman kedua bila halaman pertama tepat penuh", async () => {
    const pages = [Array.from({ length: PAGE_SIZE }, () => 1), []];
    let i = 0;
    const rows = await fetchAllPaged<number>(async () => pages[i++] ?? []);
    expect(rows).toHaveLength(PAGE_SIZE);
    expect(i).toBe(2);
  });
});

describe("buildAlpaRows — kasus ANDIKA (data terpotong batas 1000 baris)", () => {
  const mulai = "2026-08-04";
  const sampai = "2026-08-22";

  it("tidak menghitung alpa untuk siswa yang selalu hadir penuh", () => {
    const att = hadirPenuh("u1", hariKerja(mulai, sampai));
    const rows = buildAlpaRows({
      profiles: [profil("u1", "ANDIKA RAMADHAN")],
      attendance: att,
      overrides: new Map(),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    expect(rows).toEqual([]);
  });

  it("tidak melaporkan alpa palsu saat data absensi kosong (regresi batas 1000 baris)", () => {
    const rows = buildAlpaRows({
      profiles: [profil("u1", "ANDIKA RAMADHAN")],
      attendance: [], // simulasi data terpotong: siswa dilewati, bukan dianggap alpa
      overrides: new Map(),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    expect(rows).toEqual([]);
  });
});

describe("buildAlpaRows — pencocokan start date", () => {
  const mulai = "2026-08-04";
  const sampai = "2026-08-22";

  it("mulai menghitung dari absen pertama siswa, bukan dari MULAI periode", () => {
    // Siswa baru mulai PKL 17 Agustus, lalu hadir penuh setiap hari kerja.
    const att = hadirPenuh("u2", hariKerja("2026-08-17", sampai));
    const rows = buildAlpaRows({
      profiles: [profil("u2", "SISWA BARU")],
      attendance: att,
      overrides: new Map(),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    expect(rows).toEqual([]);
  });

  it("tetap memakai MULAI bila absen pertama lebih awal dari periode", () => {
    // Absen 1 Agustus (sebelum periode) lalu bolos semua hari kerja periode.
    const att = hadirPenuh("u3", ["2026-08-01"]);
    const rows = buildAlpaRows({
      profiles: [profil("u3", "SISWA BOLOS")],
      attendance: att,
      overrides: new Map(),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    // 2026-08-17 libur nasional (HUT RI) dan 2026-08-08 libur bersyarat → tidak dihitung
    const expected = hariKerja(mulai, sampai).filter(
      (t) => t !== "2026-08-17" && t !== "2026-08-08",
    ).length;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.total).toBe(expected);
  });

  it("melewati siswa yang belum pernah absen sama sekali", () => {
    const rows = buildAlpaRows({
      profiles: [profil("u4", "BELUM MULAI")],
      attendance: hadirPenuh("u-lain", hariKerja(mulai, sampai)),
      overrides: new Map(),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    expect(rows).toEqual([]);
  });

  it("menghitung 0,5 hari bila hanya absen masuk", () => {
    const att: AttendanceRow[] = [
      ...hadirPenuh("u5", hariKerja("2026-08-18", sampai)),
      { user_id: "u5", jenis: "masuk", tanggal: "2026-08-18" },
    ];
    // hapus 'pulang' pada 18 Agustus
    const filtered = att.filter((r) => !(r.tanggal === "2026-08-18" && r.jenis === "pulang"));
    const rows = buildAlpaRows({
      profiles: [profil("u5", "SETENGAH HARI")],
      attendance: filtered,
      overrides: new Map(),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.total).toBe(0.5);
  });

  it("menghormati override hari aktif siswa", () => {
    // Siswa hanya kerja Senin–Jumat; Sabtu 22 Agustus tidak dihitung alpa.
    const att = hadirPenuh(
      "u6",
      hariKerja("2026-08-18", sampai).filter((t) => new Date(`${t}T00:00:00Z`).getUTCDay() !== 6),
    );
    const rows = buildAlpaRows({
      profiles: [profil("u6", "SENIN JUMAT")],
      attendance: att,
      overrides: new Map([["u6", { hari_aktif: [1, 2, 3, 4, 5], tanggal_libur: [] }]]),
      globalHari: HARI_GLOBAL,
      mulai,
      sampai,
      normalizePhone: noop,
    });
    expect(rows).toEqual([]);
  });
});

describe("groupByUser", () => {
  it("mengelompokkan jenis absen per tanggal", () => {
    const m = groupByUser([
      { user_id: "a", jenis: "masuk", tanggal: "2026-08-04" },
      { user_id: "a", jenis: "pulang", tanggal: "2026-08-04" },
      { user_id: "b", jenis: "izin", tanggal: "2026-08-04" },
    ]);
    expect([...m.get("a")!.get("2026-08-04")!].sort()).toEqual(["masuk", "pulang"]);
    expect([...m.get("b")!.get("2026-08-04")!]).toEqual(["izin"]);
  });
});

describe("status peringatan dan SP", () => {
  it.each(["peringatan", "sp1", "sp2", "sp3"])(
    "%s dihitung 1 hari ALPA dan menurunkan persentase kehadiran",
    (jenis) => {
      const tanggal = "2026-08-18";
      const byDate = new Map([[tanggal, new Set([jenis])]]);
      expect(hitungAlpa(byDate, () => false, tanggal, tanggal).total).toBe(1);
      expect(hitungKehadiran([{ jenis, tanggal }])).toEqual({
        hadir: 0,
        totalHari: 1,
        persen: 0,
      });
    },
  );

it("peringatan tetap mengalahkan catatan hadir pada tanggal yang sama", () => {
    const tanggal = "2026-08-18";
    const jenis = new Set(["masuk", "pulang", "sp1"]);
    expect(hitungAlpa(new Map([[tanggal, jenis]]), () => false, tanggal, tanggal).total).toBe(1);
    expect(hitungKehadiran([...jenis].map((value) => ({ jenis: value, tanggal })))).toEqual({
      hadir: 0,
      totalHari: 1,
      persen: 0,
    });
  });

  it.each([
    ["peringatan", "ALPA - Peringatan"],
    ["sp1", "ALPA - SP-1"],
    ["sp2", "ALPA - SP-2"],
    ["sp3", "ALPA - SP-3"],
  ])("keterangan %s → %s", (jenis, keterangan) => {
    const tanggal = "2026-08-18";
    const { items } = hitungAlpa(new Map([[tanggal, new Set([jenis])]]), () => false, tanggal, tanggal);
    expect(items).toHaveLength(1);
    expect(items[0]!.keterangan).toBe(keterangan);
  });

  it("prioritas keterangan terparah bila beberapa jenis tercatat di hari sama", () => {
    const tanggal = "2026-08-18";
    const { items } = hitungAlpa(
      new Map([[tanggal, new Set(["peringatan", "sp1", "sp3"])]]),
      () => false,
      tanggal,
      tanggal,
    );
    expect(items[0]!.keterangan).toBe("ALPA - SP-3");
  });
});
