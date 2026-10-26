import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DudiRekap = {
  tempat: string;
  profiles: Array<{ id: string; nama_siswa: string | null; kelas: string | null; tempat_magang: string | null }>;
  attendance: Array<{
    id: string;
    user_id: string;
    jenis: string;
    tanggal: string;
    waktu: string;
    nama_lokasi: string | null;
    photo_url: string | null;
  }>;
};

/** Rekap absen semua siswa pada tempat magang milik akun DUDI yang login. */
export const getRekapDudi = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DudiRekap> => {
    const { data: rr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(rr ?? []).some((r: any) => r.role === "dudi")) {
      throw new Error("Akses ditolak: hanya akun DUDI");
    }
    const { data: akun } = await supabaseAdmin
      .from("dudi_akun" as any)
      .select("nama_tempat")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!akun) throw new Error("Akun DUDI tidak ditemukan");
    const tempat = (akun as any).nama_tempat as string;

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,nama_siswa,kelas,tempat_magang")
        .eq("tempat_magang", tempat)
        .order("nama_siswa"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
    ]);
    const siswaIds = new Set((roles ?? []).map((r: any) => r.user_id as string));
    const rows = (profiles ?? []).filter((p: any) => siswaIds.has(p.id));
    const ids = rows.map((p: any) => p.id as string);
    if (ids.length === 0) return { tempat, profiles: [], attendance: [] };

    const { data: attendance } = await supabaseAdmin
      .from("attendance")
      .select("id,user_id,jenis,tanggal,waktu,nama_lokasi,photo_url")
      .in("user_id", ids)
      .order("waktu", { ascending: false })
      .limit(5000);

    return { tempat, profiles: rows as any, attendance: (attendance ?? []) as any };
  });