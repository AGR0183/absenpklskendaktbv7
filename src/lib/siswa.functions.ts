import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USERNAME_EMAIL_DOMAIN, normalizeUsername } from "./username-auth";

const usernameSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf/angka/._-");

const siswaInput = z.object({
  role: z.enum(["siswa", "guru", "admin"]).optional().default("siswa"),
  pin: z.string().regex(/^[0-9]{4,6}$/, "PIN harus 4-6 digit angka"),
  nama_lengkap: z.string().min(1).max(150),
  nisn: z.string().max(30).optional().default(""),
  kelas: z.string().max(50).optional().default(""),
  tempat_pkl: z.string().max(150).optional().default(""),
  no_hp_siswa: z.string().max(30).optional().default(""),
  no_hp_ortu: z.string().max(30).optional().default(""),
  no_hp_guru: z.string().max(30).optional().default(""),
  no_hp_dudi: z.string().max(30).optional().default(""),
});

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("guru")) {
    throw new Error("Akses ditolak: hanya admin/guru.");
  }
  return roles as string[];
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24) || "siswa";
}

async function generateUniqueUsername(base: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${base}.${suffix}`;
    const { data } = await supabaseAdmin
      .from("siswa" as any)
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}.${Date.now().toString().slice(-6)}`;
}

// Update data existing berdasarkan nama pengguna (nama_lengkap) yang sama.
// Return true bila ada data yang diperbarui.
async function updateExistingByName(input: z.infer<typeof siswaInput>): Promise<boolean> {
  const namaTrim = input.nama_lengkap.trim();
  if (!namaTrim) return false;

  const { data: siswaRow } = await supabaseAdmin
    .from("siswa" as any)
    .select("id,user_id")
    .ilike("nama_lengkap", namaTrim)
    .limit(1)
    .maybeSingle();

  const { data: profRow } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("nama_siswa", namaTrim)
    .limit(1)
    .maybeSingle();

  if (!siswaRow && !profRow) return false;

  if (siswaRow) {
    await supabaseAdmin
      .from("siswa" as any)
      .update({
        pin: input.pin,
        nama_lengkap: namaTrim,
        nisn: input.nisn?.trim() || null,
        kelas: input.kelas?.trim() || null,
        tempat_pkl: input.tempat_pkl?.trim() || null,
      } as any)
      .eq("id", (siswaRow as any).id);
  }

  const uid = ((siswaRow as any)?.user_id as string | null) ?? ((profRow as any)?.id as string | null);
  if (uid) {
    await supabaseAdmin
      .from("profiles")
      .update({
        pin: input.pin,
        nama_siswa: namaTrim,
        kelas: input.kelas?.trim() || null,
        tempat_magang: input.tempat_pkl?.trim() || null,
        no_hp_siswa: input.no_hp_siswa?.trim() || null,
        no_hp_ortu: input.no_hp_ortu?.trim() || null,
        no_hp_guru: input.no_hp_guru?.trim() || null,
        no_hp_dudi: input.no_hp_dudi?.trim() || null,
      } as any)
      .eq("id", uid);
  }
  return true;
}

async function createOneSiswa(input: z.infer<typeof siswaInput>) {
  const role = input.role ?? "siswa";
  // Cek duplikat berdasarkan nama_lengkap (case-insensitive). NISN juga dicek bila diisi.
  const namaTrim = input.nama_lengkap.trim();
  if (namaTrim) {
    const { data: dupSiswa } = await supabaseAdmin
      .from("siswa" as any)
      .select("id")
      .ilike("nama_lengkap", namaTrim)
      .limit(1)
      .maybeSingle();
    if (dupSiswa) {
      throw new Error("DUPLICATE: nama sudah terdaftar");
    }
    const { data: dupProf } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("nama_siswa", namaTrim)
      .limit(1)
      .maybeSingle();
    if (dupProf) {
      throw new Error("DUPLICATE: nama sudah terdaftar");
    }
  }
  if (input.nisn && input.nisn.trim()) {
    const { data: dupNisn } = await supabaseAdmin
      .from("siswa" as any)
      .select("id")
      .eq("nisn", input.nisn.trim())
      .limit(1)
      .maybeSingle();
    if (dupNisn) {
      throw new Error("DUPLICATE: NISN sudah terdaftar");
    }
  }
  const base = slugifyName(input.nama_lengkap);
  const username = await generateUniqueUsername(base);
  const email = `${username}@${USERNAME_EMAIL_DOMAIN}`;
  // Password backend (user login via PIN, jangan dipakai untuk login langsung)
  const password = `${input.pin}-${Math.random().toString(36).slice(2, 10)}`;
  // Create auth user
  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nama_siswa: input.nama_lengkap,
      kelas: input.kelas ?? "",
      tempat_magang: input.tempat_pkl ?? "",
      username,
      no_hp_siswa: input.no_hp_siswa ?? "",
      no_hp_ortu: input.no_hp_ortu ?? "",
      no_hp_guru: input.no_hp_guru ?? "",
      no_hp_dudi: input.no_hp_dudi ?? "",
    },
  });
  if (cErr || !created?.user) {
    throw new Error(cErr?.message ?? "Gagal membuat akun");
  }
  const uid = created.user.id;
  // Profile auto-created by trigger handle_new_user (termasuk no_hp_*).
  // Trigger juga insert role 'siswa' default.
  if (role === "siswa") {
    const { error: sErr } = await supabaseAdmin.from("siswa" as any).insert({
      user_id: uid,
      username,
      password_login: password,
      pin: input.pin,
      nama_lengkap: input.nama_lengkap,
      nisn: input.nisn ?? null,
      kelas: input.kelas ?? null,
      tempat_pkl: input.tempat_pkl ?? null,
    } as any);
    if (sErr) {
      // rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      throw new Error(sErr.message);
    }
  } else {
    // Untuk guru/admin: ganti role default 'siswa' menjadi role yang sesuai.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).eq("role", "siswa");
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role } as any);
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      throw new Error(rErr.message);
    }
  }
  // Update profile with no_hp_* + pin (in case trigger didn't pick them up)
  await supabaseAdmin
    .from("profiles")
    .update({
      no_hp_siswa: input.no_hp_siswa || null,
      no_hp_ortu: input.no_hp_ortu || null,
      no_hp_guru: input.no_hp_guru || null,
      no_hp_dudi: input.no_hp_dudi || null,
      pin: input.pin,
      nama_siswa: input.nama_lengkap,
      kelas: input.kelas || null,
      tempat_magang: input.tempat_pkl || null,
    } as any)
    .eq("id", uid);
  return { id: uid, username };
}

export const createSiswa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => siswaInput.parse(input))
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (data.role && data.role !== "siswa" && !roles.includes("admin")) {
      throw new Error("Hanya admin yang boleh membuat akun guru/admin.");
    }
    return createOneSiswa(data);
  });

export const importSiswaCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(siswaInput).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    const hasNonSiswa = data.rows.some((r) => r.role && r.role !== "siswa");
    if (hasNonSiswa && !roles.includes("admin")) {
      throw new Error("Hanya admin yang boleh import akun guru/admin.");
    }
    const results: { label: string; ok: boolean; skipped?: boolean; updated?: boolean; error?: string }[] = [];
    for (const row of data.rows) {
      try {
        const updated = await updateExistingByName(row);
        if (updated) {
          results.push({ label: `${row.nama_lengkap} (diperbarui)`, ok: true, updated: true });
          continue;
        }
        const r = await createOneSiswa(row);
        results.push({ label: `${row.nama_lengkap} [${row.role ?? "siswa"}] (${r.username})`, ok: true });
      } catch (e: any) {
        const msg = e?.message ?? "error";
        const isDup = msg.startsWith("DUPLICATE");
        results.push({ label: row.nama_lengkap, ok: false, skipped: isDup, error: msg });
      }
    }
    return { results };
  });

export const listSiswa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("siswa" as any)
      .select("id,user_id,username,pin,nama_lengkap,nisn,kelas,tempat_pkl,status_akun,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[] };
  });

export const toggleSiswaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["aktif", "nonaktif"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: row, error: gErr } = await supabaseAdmin
      .from("siswa" as any)
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr || !row) throw new Error(gErr?.message ?? "Siswa tidak ditemukan");
    const userId = (row as any).user_id as string | null;
    const { error: uErr } = await supabaseAdmin
      .from("siswa" as any)
      .update({ status_akun: data.status } as any)
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: data.status === "nonaktif" ? "876000h" : "none",
      } as any).catch(() => {});
    }
    return { ok: true };
  });

export const deleteSiswa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      user_id: z.string().uuid().optional(),
    }).refine((v) => v.id || v.user_id, "id atau user_id wajib").parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    // Cari row siswa berdasarkan id atau user_id
    let siswaId = data.id ?? null;
    let userId = data.user_id ?? null;
    if (!siswaId || !userId) {
      const q = supabaseAdmin.from("siswa" as any).select("id,user_id");
      const { data: row } = siswaId
        ? await q.eq("id", siswaId).maybeSingle()
        : await q.eq("user_id", userId!).maybeSingle();
      if (row) {
        siswaId = (row as any).id ?? siswaId;
        userId = (row as any).user_id ?? userId;
      }
    }
    // Hapus dependensi
    if (userId) {
      await supabaseAdmin.from("attendance").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
    }
    if (siswaId) {
      await supabaseAdmin.from("siswa" as any).delete().eq("id", siswaId);
    }
    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    }
    return { ok: true };
  });

export const deleteAllSiswa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirm: z.literal("HAPUS SEMUA") }).parse(input),
  )
  .handler(async ({ context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Hanya admin yang boleh menghapus semua siswa.");
    const { data: rows } = await supabaseAdmin
      .from("siswa" as any)
      .select("id,user_id");
    const list = ((rows ?? []) as unknown) as { id: string; user_id: string | null }[];
    let deleted = 0;
    const errors: string[] = [];
    for (const r of list) {
      try {
        if (r.user_id) {
          await supabaseAdmin.from("attendance").delete().eq("user_id", r.user_id);
          await supabaseAdmin.from("user_roles").delete().eq("user_id", r.user_id);
          await supabaseAdmin.from("profiles").delete().eq("id", r.user_id);
        }
        await supabaseAdmin.from("siswa" as any).delete().eq("id", r.id);
        if (r.user_id) {
          await supabaseAdmin.auth.admin.deleteUser(r.user_id).catch(() => {});
        }
        deleted++;
      } catch (e: any) {
        errors.push(e?.message ?? "error");
      }
    }
    return { ok: true, deleted, total: list.length, errors };
  });

export const setAllSiswaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      status: z.enum(["aktif", "nonaktif"]),
      confirm: z.literal("KONFIRMASI"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (!roles.includes("admin")) throw new Error("Hanya admin yang boleh mengubah status semua siswa.");
    const { data: rows } = await supabaseAdmin
      .from("siswa" as any)
      .select("id,user_id,status_akun");
    const list = ((rows ?? []) as unknown) as { id: string; user_id: string | null; status_akun: string }[];
    const targets = list.filter((r) => r.status_akun !== data.status);
    const { error: uErr } = await supabaseAdmin
      .from("siswa" as any)
      .update({ status_akun: data.status } as any)
      .in("id", targets.map((t) => t.id));
    if (uErr) throw new Error(uErr.message);
    let banned = 0;
    for (const r of targets) {
      if (!r.user_id) continue;
      try {
        await supabaseAdmin.auth.admin.updateUserById(r.user_id, {
          ban_duration: data.status === "nonaktif" ? "876000h" : "none",
        } as any);
        banned++;
      } catch {}
    }
    return { ok: true, updated: targets.length, banned, total: list.length };
  });

const updateProfileHpInput = z.object({
  no_hp_siswa: z.string().max(30).optional().nullable(),
});

export const updateMyProfileHp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProfileHpInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        no_hp_siswa: data.no_hp_siswa || null,
      } as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateSiswaFullInput = z.object({
  user_id: z.string().uuid(),
  pin: z.string().regex(/^[0-9]{4,6}$/, "PIN harus 4-6 digit angka"),
  nama_lengkap: z.string().min(1).max(150),
  nisn: z.string().max(30).optional().nullable(),
  kelas: z.string().max(50).optional().nullable(),
  tempat_pkl: z.string().max(150).optional().nullable(),
  no_hp_siswa: z.string().max(30).optional().nullable(),
  no_hp_ortu: z.string().max(30).optional().nullable(),
  no_hp_guru: z.string().max(30).optional().nullable(),
  no_hp_dudi: z.string().max(30).optional().nullable(),
});

const updateSiswaFullInput2 = updateSiswaFullInput.extend({
  pin_ortu: z.string().regex(/^[0-9]{4,6}$/).optional().nullable(),
});

export const updateSiswaFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSiswaFullInput2.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error: sErr } = await supabaseAdmin
      .from("siswa" as any)
      .update({
        pin: data.pin,
        nama_lengkap: data.nama_lengkap,
        nisn: data.nisn || null,
        kelas: data.kelas || null,
        tempat_pkl: data.tempat_pkl || null,
      } as any)
      .eq("user_id", data.user_id);
    if (sErr) throw new Error(sErr.message);
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        pin: data.pin,
        nama_siswa: data.nama_lengkap,
        kelas: data.kelas || null,
        tempat_magang: data.tempat_pkl || null,
        no_hp_siswa: data.no_hp_siswa || null,
        no_hp_ortu: data.no_hp_ortu || null,
        no_hp_guru: data.no_hp_guru || null,
        no_hp_dudi: data.no_hp_dudi || null,
        ...(data.pin_ortu ? { pin_ortu: data.pin_ortu } : {}),
      } as any)
      .eq("id", data.user_id);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });

export const hasAnyAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "guru"]);
    if (rErr) throw new Error(rErr.message);
    const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
    if (userIds.length === 0) return { rows: [] as any[] };
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, nama_siswa, no_hp_siswa")
      .in("id", userIds);
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    // Group roles per user
    const byUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const arr = byUser.get((r as any).user_id) ?? [];
      arr.push((r as any).role);
      byUser.set((r as any).user_id, arr);
    }
    const rows = userIds.map((uid) => {
      const p: any = profMap.get(uid) ?? {};
      const roles = byUser.get(uid) ?? [];
      return {
        user_id: uid,
        nama: p.nama_siswa ?? "(tanpa nama)",
        no_hp: p.no_hp_siswa ?? null,
        roles,
        is_admin: roles.includes("admin"),
        is_guru: roles.includes("guru"),
      };
    });
    rows.sort((a, b) => (a.nama ?? "").localeCompare(b.nama ?? ""));
    return { rows };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (!roles.includes("admin")) {
      throw new Error("Hanya admin yang boleh menghapus akun guru/admin.");
    }
    if (data.user_id === context.userId) {
      throw new Error("Tidak bisa menghapus akun Anda sendiri.");
    }
    // Hapus dependensi
    await supabaseAdmin.from("attendance").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("siswa" as any).delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    await supabaseAdmin.auth.admin.deleteUser(data.user_id).catch(() => {});
    return { ok: true };
  });

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      username: usernameSchema,
      password: z.string().min(6).max(128),
      nama_lengkap: z.string().min(1).max(150),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      throw new Error("Admin sudah ada. Bootstrap tidak diizinkan.");
    }
    const username = normalizeUsername(data.username);
    const email = `${username}@${USERNAME_EMAIL_DOMAIN}`;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nama_siswa: data.nama_lengkap,
        kelas: "-",
        tempat_magang: "-",
        username,
      },
    });
    if (cErr || !created?.user) throw new Error(cErr?.message ?? "Gagal");
    const uid = created.user.id;
    // Add admin role (in addition to default 'siswa' from trigger)
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    return { ok: true, username };
  });

export const deleteAllStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirm: z.literal("HAPUS SEMUA") }).parse(input),
  )
  .handler(async ({ context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    if (!roles.includes("admin")) {
      throw new Error("Hanya admin yang boleh menghapus semua akun staf.");
    }
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "guru"]);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id as string)))
      .filter((uid) => uid !== context.userId);
    let deleted = 0;
    const errors: string[] = [];
    for (const uid of ids) {
      try {
        await supabaseAdmin.from("attendance").delete().eq("user_id", uid);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
        await supabaseAdmin.from("siswa" as any).delete().eq("user_id", uid);
        await supabaseAdmin.from("profiles").delete().eq("id", uid);
        await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
        deleted++;
      } catch (e: any) {
        errors.push(e?.message ?? "error");
      }
    }
    return { ok: true, deleted, total: ids.length, errors };
  });