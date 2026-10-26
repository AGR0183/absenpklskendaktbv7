import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePhone, sendFonnte, todayWita, loadWaSettings, loadWaOverrides } from "@/lib/wa.server";
import { formatHari } from "@/lib/kehadiran";
import { buildAlpaRows, fetchAllPaged, type AttendanceRow } from "@/lib/alpa-summary";

const MULAI = "2026-08-04";

function prevDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Kirim ulang ringkasan ALPA (versi terbaru) ke satu nomor tujuan. */
export const Route = createFileRoute("/api/public/hooks/wa-alpa-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { phone?: string };
        const target = normalizePhone(body.phone);
        if (!target) return Response.json({ error: "phone_invalid" }, { status: 400 });

        const tgl = todayWita();
        const sampai = prevDay(tgl);
        const settings = await loadWaSettings();
        const globalHari = settings?.hari_aktif ?? [1, 2, 3, 4, 5, 6];
        const overrides = await loadWaOverrides();

        const [{ data: roleRows }, { data: siswaRows }] = await Promise.all([
          supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
          supabaseAdmin.from("siswa").select("user_id,status_akun"),
        ]);
        const nonaktif = new Set(
          ((siswaRows ?? []) as { user_id: string | null; status_akun: string }[])
            .filter((s) => s.status_akun === "nonaktif" && s.user_id)
            .map((s) => s.user_id as string),
        );
        const siswaIds = (roleRows ?? [])
          .map((r: any) => r.user_id as string)
          .filter((id: string) => !nonaktif.has(id));

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, nama_siswa, kelas, tempat_magang, no_hp_guru" as any)
          .in("id", siswaIds);

        const att = await fetchAllPaged<AttendanceRow>(async (from, to) => {
          const { data: chunk, error } = await supabaseAdmin
            .from("attendance")
            .select("user_id, jenis, tanggal")
            .gte("tanggal", MULAI)
            .lte("tanggal", sampai)
            .in("user_id", siswaIds)
            .order("id", { ascending: true })
            .range(from, to);
          if (error) throw new Error(error.message);
          return (chunk ?? []) as AttendanceRow[];
        });

        const rows = buildAlpaRows({
          profiles: (profiles ?? []) as any[],
          attendance: att,
          overrides: overrides as any,
          globalHari,
          mulai: MULAI,
          sampai,
          normalizePhone,
        });

        const msg =
          `*Rekap ALPA Siswa PKL*\nPeriode: ${MULAI} s/d ${sampai}\n\n` +
          (rows.length
            ? rows
                .map((r, i) => `${i + 1}. ${r.nama} (${r.kelas}) @ ${r.tempat} — ${formatHari(r.total)} hari alpa`)
                .join("\n")
            : "Tidak ada siswa dengan catatan alpa.") +
          `\n\nTotal siswa: ${rows.length}\n\n— SIAP PKL SMKN 2 Kotabaru`;

        const r = await sendFonnte(target, msg);
        return Response.json({ target, total: rows.length, ok: r.ok, error: r.error, preview: msg });
      },
    },
  },
});
