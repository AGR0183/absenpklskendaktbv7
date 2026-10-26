import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DUDI_EMAIL_DOMAIN = "dudi.pkl.local";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "dudi";
}

export type DudiTempat = { nama: string; jumlah: number };

/** Daftar tempat magang (DUDI) yang bisa dipilih saat login. Public. */
export const listDudiTempat = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ rows: DudiTempat[] }> => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,tempat_magang"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
    ]);
    const siswaIds = new Set((roles ?? []).map((r: any) => r.user_id as string));
    const map = new Map<string, number>();
    for (const p of (profiles ?? []) as any[]) {
      if (!siswaIds.has(p.id)) continue;
      const t = (p.tempat_magang ?? "").trim();
      if (!t) continue;
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    const rows = Array.from(map.entries())
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    return { rows };
  },
);

/** Login DUDI: pilih tempat magang + PIN (standar 1234). */
export const loginDudi = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        tempat: z.string().trim().min(1).max(150),
        pin: z.string().min(4).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const tempat = data.tempat.trim();

    // Pastikan tempat magang memang ada pada profil siswa
    const { data: cek } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("tempat_magang", tempat)
      .limit(1);
    if (!cek || cek.length === 0) throw new Error("Tempat magang tidak ditemukan");

    // Ambil / buat akun DUDI
    let { data: akun } = await supabaseAdmin
      .from("dudi_akun" as any)
      .select("id,nama_tempat,pin,user_id")
      .eq("nama_tempat", tempat)
      .maybeSingle();
    if (!akun) {
      const { data: created, error } = await supabaseAdmin
        .from("dudi_akun" as any)
        .insert({ nama_tempat: tempat } as any)
        .select("id,nama_tempat,pin,user_id")
        .single();
      if (error) throw new Error(error.message);
      akun = created as any;
    }
    if ((akun as any).pin !== data.pin) throw new Error("PIN salah");

    const email = `dudi-${slugify(tempat)}-${(akun as any).id.slice(0, 8)}@${DUDI_EMAIL_DOMAIN}`;

    let userId: string | null = (akun as any).user_id ?? null;
    if (!userId) {
      const { data: createdUser, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nama_siswa: `DUDI ${tempat}`, dudi_tempat: tempat },
      });
      if (cErr || !createdUser?.user) {
        throw new Error(cErr?.message ?? "Gagal membuat akun DUDI");
      }
      userId = createdUser.user.id;
      await supabaseAdmin
        .from("dudi_akun" as any)
        .update({ user_id: userId } as any)
        .eq("id", (akun as any).id);
    }

    // Pastikan role 'dudi'
    const { data: rr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!(rr ?? []).some((r: any) => r.role === "dudi")) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "dudi" as any } as any);
    }
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "siswa" as any);

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !link?.properties?.hashed_token) {
      throw new Error(lErr?.message ?? "Gagal membuat token login");
    }
    return { token_hash: link.properties.hashed_token, tempat };
  });

/** DUDI mengubah PIN sendiri. */
export const changeDudiPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ newPin: z.string().regex(/^[0-9]{4,6}$/, "PIN harus 4-6 digit angka") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(rr ?? []).some((r: any) => r.role === "dudi")) throw new Error("Akses ditolak");
    const { error } = await supabaseAdmin
      .from("dudi_akun" as any)
      .update({ pin: data.newPin } as any)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });