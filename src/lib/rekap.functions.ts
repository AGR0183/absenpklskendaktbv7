import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getRekap = createServerFn({ method: "GET" })
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId || typeof data.userId !== "string" || data.userId.length > 64) {
      throw new Error("userId invalid");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const [{ data: profile }, { data: siswa }, { data: attendance }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,nama_siswa,kelas,tempat_magang,no_hp_siswa,no_hp_ortu,no_hp_guru,no_hp_dudi,pin_ortu")
        .eq("id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("siswa")
        .select("pin,nama_lengkap,nisn,kelas,tempat_pkl,user_id")
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("attendance")
        .select("id,jenis,tanggal,waktu,nama_lokasi,photo_url")
        .eq("user_id", data.userId)
        .order("waktu", { ascending: false })
        .limit(500),
    ]);
    if (!profile) throw new Error("Siswa tidak ditemukan");
    const [{ data: ovr }, { data: setting }] = await Promise.all([
      supabaseAdmin
        .from("wa_schedule_overrides" as any)
        .select("hari_aktif,tanggal_libur")
        .eq("siswa_user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("wa_schedule_settings" as any)
        .select("hari_aktif")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    return {
      profile,
      siswa: siswa ?? null,
      attendance: attendance ?? [],
      jadwal: {
        hari_aktif: ((ovr as any)?.hari_aktif ?? null) as number[] | null,
        tanggal_libur: (((ovr as any)?.tanggal_libur ?? []) as string[]),
      },
      hariAktifGlobal: (((setting as any)?.hari_aktif ?? [1, 2, 3, 4, 5, 6]) as number[]),
    };
  });

async function fetchAllAttendance() {
  const pageSize = 1000;
  const batchSize = 6; // ambil 6 halaman sekaligus agar tidak timeout
  const maxPages = 60;
  const all: any[] = [];
  const getPage = async (page: number) => {
    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("id,user_id,jenis,tanggal,waktu,nama_lokasi,photo_url")
      .order("waktu", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  for (let start = 0; start < maxPages; start += batchSize) {
    const pages = await Promise.all(
      Array.from({ length: batchSize }, (_, i) => getPage(start + i)),
    );
    let done = false;
    for (const rows of pages) {
      all.push(...rows);
      if (rows.length < pageSize) done = true;
    }
    if (done) break;
  }
  return all;
}

export const getRekapAll = createServerFn({ method: "GET" }).handler(async () => {
  const [{ data: profiles }, attendance, { data: roles }, { data: siswaRows }, { data: overrides }, { data: setting }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id,nama_siswa,kelas,tempat_magang")
      .order("nama_siswa"),
    fetchAllAttendance(),
    supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
    supabaseAdmin.from("siswa").select("user_id,status_akun"),
    supabaseAdmin
      .from("wa_schedule_overrides" as any)
      .select("siswa_user_id,hari_aktif,tanggal_libur"),
    supabaseAdmin
      .from("wa_schedule_settings" as any)
      .select("hari_aktif")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  const nonaktif = new Set(
    ((siswaRows ?? []) as { user_id: string | null; status_akun: string }[])
      .filter((s) => s.status_akun === "nonaktif" && s.user_id)
      .map((s) => s.user_id as string),
  );
  const siswaIds = new Set(
    (roles ?? [])
      .map((r: { user_id: string }) => r.user_id)
      .filter((id: string) => !nonaktif.has(id)),
  );
  const siswaProfiles = (profiles ?? []).filter((p) => siswaIds.has(p.id));
  const jadwal: Record<string, { hari_aktif: number[] | null; tanggal_libur: string[] }> = {};
  for (const o of ((overrides ?? []) as any[])) {
    jadwal[o.siswa_user_id] = {
      hari_aktif: (o.hari_aktif ?? null) as number[] | null,
      tanggal_libur: ((o.tanggal_libur ?? []) as string[]),
    };
  }
  return {
    profiles: siswaProfiles,
    attendance: attendance ?? [],
    jadwal,
    hariAktifGlobal: (((setting as any)?.hari_aktif ?? [1, 2, 3, 4, 5, 6]) as number[]),
  };
});

function witaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
}

/**
 * Versi ringan: hanya absensi hari ini + daftar siswa.
 * Dipakai kartu "Belum Absen" agar tidak mengunduh seluruh riwayat.
 */
export const getBelumAbsenHariIni = createServerFn({ method: "GET" }).handler(async () => {
  const tanggal = witaToday();
  const [{ data: profiles }, { data: roles }, { data: today }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,nama_siswa,kelas,tempat_magang").order("nama_siswa"),
    supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
    supabaseAdmin.from("attendance").select("user_id,jenis").eq("tanggal", tanggal),
  ]);
  const siswaIds = new Set((roles ?? []).map((r: { user_id: string }) => r.user_id));
  return {
    tanggal,
    profiles: (profiles ?? []).filter((p) => siswaIds.has(p.id)),
    today: (today ?? []) as { user_id: string; jenis: string }[],
  };
});

/**
 * Versi ringkas untuk statistik: kolom minimal, tanpa foto/lokasi/waktu.
 */
export const getRekapRingkas = createServerFn({ method: "GET" }).handler(async () => {
  const pageSize = 1000;
  const getPage = async (page: number) => {
    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("user_id,jenis,tanggal")
      .order("id")
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const attendance: { user_id: string; jenis: string; tanggal: string }[] = [];
  for (let page = 0; page < 60; page++) {
    const rows = await getPage(page);
    attendance.push(...(rows as any[]));
    if (rows.length < pageSize) break;
  }

  const [{ data: profiles }, { data: roles }, { data: siswaRows }, { data: overrides }, { data: setting }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id").order("id"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
      supabaseAdmin.from("siswa").select("user_id,status_akun"),
      supabaseAdmin
        .from("wa_schedule_overrides" as any)
        .select("siswa_user_id,hari_aktif,tanggal_libur"),
      supabaseAdmin
        .from("wa_schedule_settings" as any)
        .select("hari_aktif")
        .eq("id", 1)
        .maybeSingle(),
    ]);
  const nonaktif = new Set(
    ((siswaRows ?? []) as { user_id: string | null; status_akun: string }[])
      .filter((s) => s.status_akun === "nonaktif" && s.user_id)
      .map((s) => s.user_id as string),
  );
  const siswaIds = new Set(
    (roles ?? [])
      .map((r: { user_id: string }) => r.user_id)
      .filter((id: string) => !nonaktif.has(id)),
  );
  const jadwal: Record<string, { hari_aktif: number[] | null; tanggal_libur: string[] }> = {};
  for (const o of ((overrides ?? []) as any[])) {
    jadwal[o.siswa_user_id] = {
      hari_aktif: (o.hari_aktif ?? null) as number[] | null,
      tanggal_libur: ((o.tanggal_libur ?? []) as string[]),
    };
  }
  return {
    siswaIds: Array.from(siswaIds).filter((id) => (profiles ?? []).some((p) => p.id === id)),
    attendance,
    jadwal,
    hariAktifGlobal: (((setting as any)?.hari_aktif ?? [1, 2, 3, 4, 5, 6]) as number[]),
  };
});

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("guru")) {
    throw new Error("Akses ditolak: hanya admin/guru.");
  }
  return roles as string[];
}

export const deleteAttendancePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: row, error: selErr } = await supabaseAdmin
      .from("attendance")
      .select("id, photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Data absen tidak ditemukan");
    if (row.photo_url) {
      const marker = "/attendance-photos/";
      const idx = row.photo_url.indexOf(marker);
      let path: string | null = null;
      if (idx >= 0) path = row.photo_url.substring(idx + marker.length);
      else if (!/^https?:\/\//i.test(row.photo_url)) path = row.photo_url;
      if (path) {
        const { error: rmErr } = await supabaseAdmin.storage
          .from("attendance-photos")
          .remove([path]);
        if (rmErr) console.error("[deleteAttendancePhoto] storage", rmErr);
      }
    }
    const { error: updErr } = await supabaseAdmin
      .from("attendance")
      .update({ photo_url: null })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true, id: data.id };
  });

export const deleteAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (!roles.includes("admin")) {
      throw new Error("Hanya admin yang boleh menghapus data absen.");
    }
    const { data: row } = await supabaseAdmin
      .from("attendance")
      .select("id, photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.photo_url) {
      const marker = "/attendance-photos/";
      const idx = row.photo_url.indexOf(marker);
      let path: string | null = null;
      if (idx >= 0) path = row.photo_url.substring(idx + marker.length);
      else if (!/^https?:\/\//i.test(row.photo_url)) path = row.photo_url;
      if (path) {
        await supabaseAdmin.storage.from("attendance-photos").remove([path]);
      }
    }
    const { error } = await supabaseAdmin.from("attendance").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  });

export const deleteOwnAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("attendance")
      .select("id, user_id, photo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Data absen tidak ditemukan");
    if (row.user_id !== context.userId) throw new Error("Akses ditolak.");
    if (row.photo_url) {
      const marker = "/attendance-photos/";
      const idx = row.photo_url.indexOf(marker);
      let path: string | null = null;
      if (idx >= 0) path = row.photo_url.substring(idx + marker.length);
      else if (!/^https?:\/\//i.test(row.photo_url)) path = row.photo_url;
      if (path) {
        await supabaseAdmin.storage.from("attendance-photos").remove([path]);
      }
    }
    const { error } = await supabaseAdmin.from("attendance").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  });

// Admin: tandai/ubah status absen pada tanggal tertentu (dipakai di rekap ALPA)
export const setAttendanceJenis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        jenis: z.enum([
          "masuk",
          "pulang",
          "izin",
          "sakit",
          "libur",
          "peringatan",
          "sp1",
          "sp2",
          "sp3",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (!roles.includes("admin")) {
      throw new Error("Hanya admin yang boleh mengubah status absen.");
    }
    // Tandai tanggal sebagai LIBUR pribadi siswa (bukan catatan absen)
    if (data.jenis === "libur") {
      const { data: ov } = await supabaseAdmin
        .from("wa_schedule_overrides" as any)
        .select("tanggal_libur")
        .eq("siswa_user_id", data.user_id)
        .maybeSingle();
      const list = new Set<string>(((ov as any)?.tanggal_libur ?? []) as string[]);
      list.add(data.tanggal);
      const { error: upErr } = await supabaseAdmin
        .from("wa_schedule_overrides" as any)
        .upsert(
          {
            siswa_user_id: data.user_id,
            tanggal_libur: Array.from(list).sort(),
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "siswa_user_id" },
        );
      if (upErr) throw new Error(upErr.message);
      return { ok: true, id: null, existed: false };
    }
    // Sudah ada catatan jenis yang sama pada tanggal itu? jangan duplikat.
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("user_id", data.user_id)
      .eq("tanggal", data.tanggal)
      .eq("jenis", data.jenis)
      .maybeSingle();
    if (existing) return { ok: true, id: existing.id, existed: true };

    // Jam default (WITA, UTC+8): masuk 08:00, pulang 15:00, izin/sakit/peringatan/SP 07:00
    const jamWita =
      data.jenis === "masuk" ? "08:00" : data.jenis === "pulang" ? "15:00" : "07:00";
    const waktu = new Date(`${data.tanggal}T${jamWita}:00+08:00`).toISOString();

    const { data: inserted, error } = await supabaseAdmin
      .from("attendance")
      .insert({
        user_id: data.user_id,
        jenis: data.jenis,
        tanggal: data.tanggal,
        waktu,
        nama_lokasi: "Diinput admin",
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id ?? null, existed: false };
  });