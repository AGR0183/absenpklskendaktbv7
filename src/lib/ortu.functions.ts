import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOrtu(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("ortu")) throw new Error("Akses ditolak: hanya orang tua");
}

/** Daftar anak yang tertaut ke ortu yang login. */
export const listAnak = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOrtu(context.supabase, context.userId);
    const { data: links } = await supabaseAdmin
      .from("ortu_link" as any)
      .select("siswa_user_id")
      .eq("ortu_user_id", context.userId);
    const ids = (links ?? []).map((l: any) => l.siswa_user_id as string);
    if (ids.length === 0) return { anak: [] as Array<{ user_id: string; nama: string; kelas: string | null; tempat_magang: string | null }> };
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,nama_siswa,kelas,tempat_magang")
      .in("id", ids);
    const anak = (profs ?? []).map((p: any) => ({
      user_id: p.id,
      nama: p.nama_siswa ?? "(tanpa nama)",
      kelas: p.kelas,
      tempat_magang: p.tempat_magang,
    }));
    return { anak };
  });

/** Rekap absen 1 anak — hanya jika tertaut ke ortu yang login. */
export const getRekapAnak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ siswaUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOrtu(context.supabase, context.userId);
    // Verifikasi link
    const { data: link } = await supabaseAdmin
      .from("ortu_link" as any)
      .select("id")
      .eq("ortu_user_id", context.userId)
      .eq("siswa_user_id", data.siswaUserId)
      .maybeSingle();
    if (!link) throw new Error("Anak tidak tertaut ke akun ini");

    const [{ data: profile }, { data: siswa }, { data: attendance }, { data: ovr }, { data: setting }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,nama_siswa,kelas,tempat_magang,no_hp_siswa,no_hp_ortu,no_hp_guru,no_hp_dudi")
        .eq("id", data.siswaUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("siswa")
        .select("nama_lengkap,nisn,kelas,tempat_pkl,user_id")
        .eq("user_id", data.siswaUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("attendance")
        .select("id,jenis,tanggal,waktu,nama_lokasi,latitude,longitude,photo_url")
        .eq("user_id", data.siswaUserId)
        .order("waktu", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("wa_schedule_overrides" as any)
        .select("hari_aktif,tanggal_libur")
        .eq("siswa_user_id", data.siswaUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("wa_schedule_settings" as any)
        .select("hari_aktif")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error("Data anak tidak ditemukan");
    // Buat signed URL untuk foto absen agar ortu bisa melihat
    const withSigned = await Promise.all(
      (attendance ?? []).map(async (r: any) => {
        let signed: string | null = null;
        if (r.photo_url) {
          const marker = "/attendance-photos/";
          const idx = r.photo_url.indexOf(marker);
          const path = idx >= 0 ? r.photo_url.substring(idx + marker.length) : r.photo_url;
          const { data } = await supabaseAdmin.storage
            .from("attendance-photos")
            .createSignedUrl(path, 3600);
          signed = data?.signedUrl ?? null;
        }
        return { ...r, photo_signed_url: signed };
      }),
    );
    return {
      profile,
      siswa: siswa ?? null,
      attendance: withSigned,
      jadwal: {
        hari_aktif: ((ovr as any)?.hari_aktif ?? null) as number[] | null,
        tanggal_libur: (((ovr as any)?.tanggal_libur ?? []) as string[]),
      },
      hariAktifGlobal: (((setting as any)?.hari_aktif ?? [1, 2, 3, 4, 5, 6]) as number[]),
    };
  });

/** Tautkan anak (siswa) tambahan ke akun ortu yang sedang login. */
export const addAnak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ siswaUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOrtu(context.supabase, context.userId);
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id,nama_siswa")
      .eq("id", data.siswaUserId)
      .maybeSingle();
    if (!prof) throw new Error("Siswa tidak ditemukan");
    const { error } = await supabaseAdmin
      .from("ortu_link" as any)
      .upsert(
        { ortu_user_id: context.userId, siswa_user_id: data.siswaUserId } as any,
        { onConflict: "ortu_user_id,siswa_user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, siswaUserId: data.siswaUserId, nama: prof.nama_siswa };
  });

/** Lepas tautan anak dari akun ortu yang sedang login. */
export const removeAnak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ siswaUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOrtu(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("ortu_link" as any)
      .delete()
      .eq("ortu_user_id", context.userId)
      .eq("siswa_user_id", data.siswaUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ubah PIN login orang tua untuk salah satu anak yang tertaut. */
export const changePinOrtu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        siswaUserId: z.string().uuid(),
        pinLama: z.string().regex(/^\d{4}$/),
        pinBaru: z.string().regex(/^\d{4}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOrtu(context.supabase, context.userId);
    const { data: link } = await supabaseAdmin
      .from("ortu_link" as any)
      .select("id")
      .eq("ortu_user_id", context.userId)
      .eq("siswa_user_id", data.siswaUserId)
      .maybeSingle();
    if (!link) throw new Error("Anak tidak tertaut ke akun ini");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id,pin_ortu")
      .eq("id", data.siswaUserId)
      .maybeSingle();
    if (!prof) throw new Error("Data anak tidak ditemukan");
    if (((prof as any).pin_ortu ?? "1122") !== data.pinLama) {
      throw new Error("PIN lama salah");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ pin_ortu: data.pinBaru } as any)
      .eq("id", data.siswaUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

