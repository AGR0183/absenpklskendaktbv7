import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HOLIDAYS } from "@/lib/holidays";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) throw new Error("Hanya admin");
}

export const getWaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await supabaseAdmin
      .from("wa_schedule_settings" as any)
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return { settings: data };
  });

const tahap = z.enum(["siswa", "pulang", "ortu", "dudi", "guru"]);

export const updateWaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        jam_siswa: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        jam_pulang: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        jam_ortu: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        jam_dudi: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        jam_guru: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        aktif_siswa: z.boolean().optional(),
        aktif_pulang: z.boolean().optional(),
        aktif_ortu: z.boolean().optional(),
        aktif_dudi: z.boolean().optional(),
        aktif_guru: z.boolean().optional(),
        template_siswa: z.string().max(2000).optional(),
        template_pulang: z.string().max(2000).optional(),
        template_ortu: z.string().max(2000).optional(),
        template_dudi: z.string().max(2000).optional(),
        template_guru: z.string().max(2000).optional(),
        hari_aktif: z.array(z.number().int().min(0).max(6)).optional(),
        fonnte_token: z.string().max(200).optional().nullable(),
        fonnte_sender: z.string().max(30).optional().nullable(),
        jeda_menit: z.number().min(0).max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("wa_schedule_settings" as any)
      .update(patch as any)
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWaOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await supabaseAdmin.from("wa_schedule_overrides" as any).select("*");
    return { rows: (data ?? []) as any[] };
  });

export const setWaOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        siswa_user_id: z.string().uuid(),
        disable_all: z.boolean().optional(),
        skip_siswa: z.boolean().optional(),
        skip_pulang: z.boolean().optional(),
        skip_ortu: z.boolean().optional(),
        skip_dudi: z.boolean().optional(),
        skip_guru: z.boolean().optional(),
        hari_aktif: z.array(z.number().int().min(0).max(6)).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { siswa_user_id, ...rest } = data;
    const payload: Record<string, unknown> = {
      siswa_user_id,
      disable_all: rest.disable_all ?? false,
      skip_siswa: rest.skip_siswa ?? false,
      skip_pulang: rest.skip_pulang ?? false,
      skip_ortu: rest.skip_ortu ?? false,
      skip_dudi: rest.skip_dudi ?? false,
      skip_guru: rest.skip_guru ?? false,
      updated_at: new Date().toISOString(),
    };
    if (rest.hari_aktif !== undefined) payload.hari_aktif = rest.hari_aktif;
    const { error } = await supabaseAdmin
      .from("wa_schedule_overrides" as any)
      .upsert(payload as any, { onConflict: "siswa_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ Siswa: kelola hari_aktif sendiri ============ */

export const getMyWaSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ov } = await supabaseAdmin
      .from("wa_schedule_overrides" as any)
      .select("hari_aktif, tanggal_libur")
      .eq("siswa_user_id", context.userId)
      .maybeSingle();
    const { data: s } = await supabaseAdmin
      .from("wa_schedule_settings" as any)
      .select("hari_aktif")
      .eq("id", 1)
      .maybeSingle();
    return {
      hari_aktif: ((ov as any)?.hari_aktif ?? null) as number[] | null,
      hari_aktif_global: ((s as any)?.hari_aktif ?? [1, 2, 3, 4, 5]) as number[],
      tanggal_libur: (((ov as any)?.tanggal_libur ?? []) as string[]),
      libur_nasional: HOLIDAYS,
    };
  });

export const setMyWaHariAktif = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        hari_aktif: z.array(z.number().int().min(0).max(6)).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      siswa_user_id: context.userId,
      hari_aktif: data.hari_aktif,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("wa_schedule_overrides" as any)
      .upsert(payload as any, { onConflict: "siswa_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const setMyWaTanggalLibur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tanggal_libur: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      siswa_user_id: context.userId,
      tanggal_libur: Array.from(new Set(data.tanggal_libur)).sort(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("wa_schedule_overrides" as any)
      .upsert(payload as any, { onConflict: "siswa_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
