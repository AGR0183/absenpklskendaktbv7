import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["siswa", "guru", "admin"]);

export type LoginCandidate = { id: string; user_id: string; nama: string; kelas?: string | null };

/** List nama yang bisa dipilih saat login. Public — tidak butuh auth. */
export const getLoginCandidates = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ role: roleSchema }).parse(input))
  .handler(async ({ data }): Promise<{ rows: LoginCandidate[] }> => {
    if (data.role === "siswa") {
      const { data: rows, error } = await supabaseAdmin
        .from("siswa" as any)
        .select("id,user_id,nama_lengkap,kelas,status_akun")
        .eq("status_akun", "aktif")
        .order("nama_lengkap", { ascending: true });
      if (error) throw new Error(error.message);
      const out = (rows ?? [])
        .filter((r: any) => r.user_id)
        .map((r: any) => ({ id: r.id, user_id: r.user_id, nama: r.nama_lengkap, kelas: r.kelas }));
      return { rows: out };
    }
    // guru / admin → cari berdasarkan user_roles + profiles
    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", data.role);
    if (rErr) throw new Error(rErr.message);
    const ids = (roleRows ?? []).map((r: any) => r.user_id as string);
    if (ids.length === 0) return { rows: [] };
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,nama_siswa,kelas")
      .in("id", ids);
    const out = (profs ?? [])
      .map((p: any) => ({ id: p.id, user_id: p.id, nama: p.nama_siswa ?? "(tanpa nama)", kelas: p.kelas }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return { rows: out };
  });

/** Verifikasi PIN & kembalikan token magic-link untuk diselesaikan di client. */
export const loginWithPin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        role: roleSchema,
        user_id: z.string().uuid(),
        pin: z.string().min(4).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // --- Lockout check ---
    const MAX_ATTEMPTS = 10;
    const LOCK_MINUTES = 30;
    const { data: lock } = await supabaseAdmin
      .from("pin_lockout" as any)
      .select("failed_count,locked_until")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (lock && (lock as any).locked_until && new Date((lock as any).locked_until) > new Date()) {
      throw new Error("Akun terkunci sementara karena terlalu banyak percobaan PIN salah. Silakan hubungi admin.");
    }

    // Validasi PIN
    let pinOk = false;
    if (data.role === "siswa") {
      const { data: row } = await supabaseAdmin
        .from("siswa" as any)
        .select("pin,status_akun")
        .eq("user_id", data.user_id)
        .maybeSingle();
      if (!row) throw new Error("Akun tidak ditemukan");
      if ((row as any).status_akun === "nonaktif") throw new Error("Akun nonaktif");
      pinOk = (row as any).pin === data.pin;
    } else {
      // Cek role match
      const { data: rr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user_id);
      const roles = (rr ?? []).map((r: any) => r.role);
      if (!roles.includes(data.role)) throw new Error("Akun tidak memiliki peran tersebut");
      const { data: prof } = await supabaseAdmin
        .from("profiles" as any)
        .select("pin")
        .eq("id", data.user_id)
        .maybeSingle();
      if (!prof) throw new Error("Profil tidak ditemukan");
      pinOk = (prof as any).pin === data.pin;
    }
    if (!pinOk) {
      const current = (lock as any)?.failed_count ?? 0;
      const next = current + 1;
      const shouldLock = next >= MAX_ATTEMPTS;
      const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
      await supabaseAdmin.from("pin_lockout" as any).upsert({
        user_id: data.user_id,
        failed_count: next,
        locked_until: lockedUntil,
        last_failed_at: new Date().toISOString(),
      } as any);
      if (shouldLock) {
        throw new Error(`Akun terkunci sementara karena ${MAX_ATTEMPTS}x PIN salah. Silakan hubungi admin.`);
      }
      const sisa = MAX_ATTEMPTS - next;
      throw new Error(`PIN salah. Sisa percobaan: ${sisa}`);
    }

    // Reset lockout pada login sukses
    if (lock) {
      await supabaseAdmin.from("pin_lockout" as any).delete().eq("user_id", data.user_id);
    }

    // Ambil email auth.users
    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (uErr || !userRes?.user?.email) throw new Error("Email akun tidak ditemukan");
    const email = userRes.user.email;

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !link?.properties?.hashed_token) {
      throw new Error(lErr?.message ?? "Gagal membuat token login");
    }
    return { token_hash: link.properties.hashed_token, email };
  });

/** User yang sedang login mengubah PIN sendiri. */
export const changeMyPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ newPin: z.string().regex(/^[0-9]{4,6}$/, "PIN harus 4-6 digit angka") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    // Update di profiles
    await supabaseAdmin.from("profiles" as any).update({ pin: data.newPin } as any).eq("id", uid);
    // Update di siswa (jika ada baris)
    await supabaseAdmin.from("siswa" as any).update({ pin: data.newPin } as any).eq("user_id", uid);
    return { ok: true };
  });

/** Admin: lihat semua PIN. */
export const adminListPins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rr } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (rr ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Hanya admin");
    const { data: siswa } = await supabaseAdmin
      .from("siswa" as any)
      .select("id,user_id,nama_lengkap,kelas,pin,status_akun")
      .order("nama_lengkap");
    // Guru & admin lewat profiles + user_roles
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role").in("role", ["guru", "admin"]);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles" as any).select("id,nama_siswa,kelas,pin").in("id", ids)
      : { data: [] as any[] };
    const roleMap = new Map<string, string[]>();
    for (const r of (roles ?? []) as any[]) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    const { data: locks } = await supabaseAdmin
      .from("pin_lockout" as any)
      .select("user_id,failed_count,locked_until");
    const now = Date.now();
    const lockMap = new Map<string, { locked: boolean; locked_until: string | null; failed_count: number }>();
    for (const l of (locks ?? []) as any[]) {
      lockMap.set(l.user_id, {
        locked: !!l.locked_until && new Date(l.locked_until).getTime() > now,
        locked_until: l.locked_until ?? null,
        failed_count: l.failed_count ?? 0,
      });
    }
    const lockOf = (uid: string) => lockMap.get(uid) ?? { locked: false, locked_until: null, failed_count: 0 };
    return {
      siswa: ((siswa ?? []) as any[]).map((s) => ({
        id: s.id,
        user_id: s.user_id,
        nama: s.nama_lengkap,
        kelas: s.kelas,
        pin: s.pin,
        status: s.status_akun,
        ...lockOf(s.user_id),
      })),
      staf: ((profs ?? []) as any[]).map((p) => ({
        user_id: p.id,
        nama: p.nama_siswa ?? "-",
        kelas: p.kelas,
        pin: p.pin,
        roles: roleMap.get(p.id) ?? [],
        ...lockOf(p.id),
      })),
    };
  });

/** Admin: buka kunci akun yang terkunci karena salah PIN. */
export const adminUnlockPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rr } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(rr ?? []).some((r: any) => r.role === "admin")) throw new Error("Hanya admin");
    await supabaseAdmin.from("pin_lockout" as any).delete().eq("user_id", data.user_id);
    return { ok: true };
  });

/** Admin: buka kunci semua akun sekaligus. */
export const adminUnlockAllPins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rr } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(rr ?? []).some((r: any) => r.role === "admin")) throw new Error("Hanya admin");
    await supabaseAdmin.from("pin_lockout" as any).delete().not("user_id", "is", null);
    return { ok: true };
  });

/** Admin: reset PIN user. */
export const adminResetPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        newPin: z.string().regex(/^[0-9]{4,6}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rr } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (rr ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Hanya admin");
    await supabaseAdmin.from("profiles" as any).update({ pin: data.newPin } as any).eq("id", data.user_id);
    await supabaseAdmin.from("siswa" as any).update({ pin: data.newPin } as any).eq("user_id", data.user_id);
    await supabaseAdmin.from("pin_lockout" as any).delete().eq("user_id", data.user_id);
    return { ok: true };
  });