import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePhone, sendFonnte } from "@/lib/wa.server";

const ORTU_EMAIL_DOMAIN = "ortu.pkl.local";
function phoneToEmail(phone: string) {
  return `ortu-${phone}@${ORTU_EMAIL_DOMAIN}`;
}
function siswaToOrtuEmail(siswaId: string) {
  return `ortu-of-${siswaId}@${ORTU_EMAIL_DOMAIN}`;
}

/**
 * Login orang tua tanpa OTP / PIN — cukup pilih nama anak.
 * Membuat / mengambil akun ortu yang tertaut ke satu siswa, lalu
 * mengembalikan magic-link token untuk diselesaikan di client.
 */
export const loginOrtuBySiswa = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        siswaUserId: z.string().uuid(),
        pin: z.string().regex(/^[0-9]{4,6}$/, "PIN harus 4-6 digit angka"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Pastikan siswa ada
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id,nama_siswa,pin_ortu")
      .eq("id", data.siswaUserId)
      .maybeSingle();
    if (!prof) throw new Error("Siswa tidak ditemukan");

    const expectedPin = ((prof as any).pin_ortu ?? "1122") as string;
    if (data.pin !== expectedPin) throw new Error("PIN salah");

    const email = siswaToOrtuEmail(data.siswaUserId);

    // Ambil / buat auth user (satu akun ortu per anak).
    // @ts-ignore - listUsers admin API
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    let user = userList?.users?.find((u: any) => u.email === email) ?? null;
    if (!user) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          nama_siswa: `Orang Tua ${prof.nama_siswa ?? ""}`.trim(),
          ortu_of: data.siswaUserId,
        },
      });
      if (cErr || !created?.user) throw new Error(cErr?.message ?? "Gagal membuat akun");
      user = created.user;
    }

    // Pastikan role 'ortu' saja
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id);
    const hasOrtu = (roles ?? []).some((r: any) => r.role === "ortu");
    if (!hasOrtu) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user!.id, role: "ortu" as any } as any);
    }
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user!.id)
      .eq("role", "siswa" as any);

    // Sinkronkan link ke anak yang dipilih
    await supabaseAdmin
      .from("ortu_link" as any)
      .upsert(
        { ortu_user_id: user!.id, siswa_user_id: data.siswaUserId } as any,
        { onConflict: "ortu_user_id,siswa_user_id" },
      );

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !link?.properties?.hashed_token) {
      throw new Error(lErr?.message ?? "Gagal membuat token login");
    }
    return { token_hash: link.properties.hashed_token, siswaUserId: data.siswaUserId };
  });

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Kirim kode OTP ke WhatsApp orang tua. */
export const requestOrtuOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ phone: z.string().min(6).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Format nomor tidak valid");

    // Cek nomor terdaftar sebagai ortu di minimal 1 profil siswa.
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,no_hp_ortu")
      .not("no_hp_ortu", "is", null);
    const anyMatch = (profs ?? []).some((p) => normalizePhone(p.no_hp_ortu) === phone);
    if (!anyMatch) throw new Error("Nomor tidak terdaftar sebagai orang tua siswa");

    const kode = generateOtp();
    const expires = new Date(Date.now() + 5 * 60_000).toISOString();
    await supabaseAdmin
      .from("ortu_otp" as any)
      .upsert({ no_hp: phone, kode, attempts: 0, expires_at: expires } as any, {
        onConflict: "no_hp",
      });

    const msg = `Kode login Orang Tua PKL SMKN 2 Kotabaru: *${kode}*\nBerlaku 5 menit. Jangan bagikan kode ini ke siapapun.`;
    const r = await sendFonnte(phone, msg);
    if (!r.ok) throw new Error("Gagal mengirim OTP: " + (r.error ?? "unknown"));
    return { ok: true, phone };
  });

/** Verifikasi OTP → kembalikan token magic-link untuk diselesaikan di client. */
export const verifyOrtuOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        phone: z.string().min(6).max(20),
        kode: z.string().regex(/^[0-9]{6}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Format nomor tidak valid");

    const { data: row } = await supabaseAdmin
      .from("ortu_otp" as any)
      .select("kode,attempts,expires_at")
      .eq("no_hp", phone)
      .maybeSingle();
    if (!row) throw new Error("Kode belum diminta");
    const r = row as any;
    if (new Date(r.expires_at) < new Date()) {
      await supabaseAdmin.from("ortu_otp" as any).delete().eq("no_hp", phone);
      throw new Error("Kode kadaluarsa, minta ulang");
    }
    if ((r.attempts ?? 0) >= 3) {
      await supabaseAdmin.from("ortu_otp" as any).delete().eq("no_hp", phone);
      throw new Error("Terlalu banyak percobaan, minta ulang kode");
    }
    if (r.kode !== data.kode) {
      await supabaseAdmin
        .from("ortu_otp" as any)
        .update({ attempts: (r.attempts ?? 0) + 1 } as any)
        .eq("no_hp", phone);
      throw new Error("Kode salah");
    }

    // OTP valid → hapus
    await supabaseAdmin.from("ortu_otp" as any).delete().eq("no_hp", phone);

    const email = phoneToEmail(phone);

    // Ambil / buat auth user
    // @ts-ignore - listUsers admin API
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    let user = userList?.users?.find((u: any) => u.email === email) ?? null;
    if (!user) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nama_siswa: `Orang Tua ${phone}`, ortu_phone: phone },
      });
      if (cErr || !created?.user) throw new Error(cErr?.message ?? "Gagal membuat akun");
      user = created.user;
    }

    // Pastikan role 'ortu'
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id);
    const hasOrtu = (roles ?? []).some((r: any) => r.role === "ortu");
    if (!hasOrtu) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user!.id, role: "ortu" as any } as any);
    }
    // Bersihkan role siswa default yang dibuat trigger handle_new_user
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user!.id)
      .eq("role", "siswa" as any);

    // Sinkronkan link ke anak-anak
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,no_hp_ortu")
      .not("no_hp_ortu", "is", null);
    const anakIds = (profs ?? [])
      .filter((p) => normalizePhone(p.no_hp_ortu) === phone)
      .map((p) => p.id);
    if (anakIds.length > 0) {
      const rows = anakIds.map((sid) => ({
        ortu_user_id: user!.id,
        siswa_user_id: sid,
      }));
      await supabaseAdmin
        .from("ortu_link" as any)
        .upsert(rows as any, { onConflict: "ortu_user_id,siswa_user_id" });
    }

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (lErr || !link?.properties?.hashed_token) {
      throw new Error(lErr?.message ?? "Gagal membuat token login");
    }
    return { token_hash: link.properties.hashed_token };
  });
