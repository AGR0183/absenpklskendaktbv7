import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  normalizePhone,
  sendFonnte,
  todayWita,
  loadWaSettings,
  loadWaOverrides,
  sleep,
} from "@/lib/wa.server";
import { formatHari } from "@/lib/kehadiran";
import { buildAlpaRows, fetchAllPaged, type AttendanceRow } from "@/lib/alpa-summary";

/** Awal periode rekap alpa (WITA) */
const MULAI = "2026-08-04";
/** Nomor admin penerima ringkasan lengkap */
const ADMIN_PHONE = "6285179584105";

function prevDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type Row = {
  id: string;
  nama: string;
  kelas: string;
  tempat: string;
  guruPhone: string | null;
  total: number;
};

/** 09.00 WITA — ringkasan rekap ALPA ke admin & guru pembimbing */
export const Route = createFileRoute("/api/public/hooks/wa-summary-alpa")({
  server: {
    handlers: {
      POST: async () => {
        const tgl = todayWita();
        const sampai = prevDay(tgl);
        if (sampai < MULAI) {
          return Response.json({ tahap: "alpa", tgl, skipped: "periode_belum_mulai" });
        }

        // dedupe harian
        const { data: logged } = await supabaseAdmin
          .from("wa_reminder_log")
          .select("id")
          .eq("tanggal", tgl)
          .eq("tahap", "alpa")
          .limit(1);
        if ((logged ?? []).length > 0) {
          return Response.json({ tahap: "alpa", tgl, skipped: "already_sent" });
        }

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
        if (siswaIds.length === 0) return Response.json({ tahap: "alpa", tgl, total: 0 });

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, nama_siswa, kelas, tempat_magang, no_hp_guru" as any)
          .in("id", siswaIds);

        // Ambil SEMUA absensi pada periode (hindari batas default 1000 baris)
        const att = await fetchAllPaged<AttendanceRow>(async (from, to) => {
          const { data: chunk, error } = await supabaseAdmin
            .from("attendance")
            .select("user_id, jenis, tanggal")
            .gte("tanggal", MULAI)
            .lte("tanggal", sampai)
            .in("user_id", siswaIds)
            // Urutan HARUS unik & stabil, kalau tidak baris bisa hilang/dobel antar halaman
            .order("id", { ascending: true })
            .range(from, to);
          if (error) throw new Error(error.message);
          return (chunk ?? []) as AttendanceRow[];
        });

        const rows: Row[] = buildAlpaRows({
          profiles: (profiles ?? []) as any[],
          attendance: att,
          overrides: overrides as any,
          globalHari,
          mulai: MULAI,
          sampai,
          normalizePhone,
        });

        const periode = `${MULAI} s/d ${sampai}`;
        const jedaMs = Math.max(0, Number(settings?.jeda_menit ?? 0)) * 60_000;
        let sent = 0, failed = 0;
        const results: any[] = [];

        const buildMsg = (list: Row[], judul: string) =>
          `${judul}\nPeriode: ${periode}\n\n` +
          list
            .map((r, i) => `${i + 1}. ${r.nama} (${r.kelas}) @ ${r.tempat} — ${formatHari(r.total)} hari alpa`)
            .join("\n") +
          `\n\nTotal siswa: ${list.length}\n\n— SIAP PKL SMKN 2 Kotabaru`;

        // 1) Admin: ringkasan seluruh siswa alpa
        if (rows.length > 0) {
          const r = await sendFonnte(ADMIN_PHONE, buildMsg(rows, "*Rekap ALPA Siswa PKL*"));
          results.push({ target: "admin", ok: r.ok, error: r.error });
          r.ok ? sent++ : failed++;
        }

        // 2) Guru pembimbing: hanya siswa bimbingannya
        const groups = new Map<string, Row[]>();
        for (const r of rows) {
          if (!r.guruPhone || r.guruPhone === ADMIN_PHONE) continue;
          if (!groups.has(r.guruPhone)) groups.set(r.guruPhone, []);
          groups.get(r.guruPhone)!.push(r);
        }
        let first = true;
        for (const [phone, list] of groups) {
          if (jedaMs > 0 && !first) await sleep(jedaMs);
          first = false;
          const r = await sendFonnte(
            phone,
            buildMsg(list, "Yth. Bapak/Ibu Guru Pembimbing,\n*Rekap ALPA Siswa Bimbingan*"),
          );
          results.push({ target: phone, ok: r.ok, error: r.error });
          r.ok ? sent++ : failed++;
        }

        // catat sekali agar tidak dobel di hari yang sama
        if (rows.length > 0) {
          await supabaseAdmin.from("wa_reminder_log").insert({
            user_id: rows[0]!.id,
            tahap: "alpa",
            status: failed > 0 && sent === 0 ? "failed" : "sent",
            detail: `${rows.length} siswa, ${groups.size} guru`,
          } as any);
        }

        return Response.json({ tahap: "alpa", tgl, periode, total: rows.length, sent, failed, results });
      },
    },
  },
});
