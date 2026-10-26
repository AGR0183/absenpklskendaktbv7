import { createFileRoute } from "@tanstack/react-router";
import {
  loadWaSettings,
  todayWita,
  isHolidayToday,
  nowWitaMinutes,
  parseJamToMinutes,
} from "@/lib/wa.server";

/**
 * Dispatcher pengingat WA.
 * Dijalankan cron setiap 5 menit; memicu tahap yang jam-nya (WITA) sudah tiba
 * sesuai "Pengaturan Notifikasi WA" di dashboard admin.
 */
const STAGES = [
  { tahap: "siswa", jamKey: "jam_siswa", aktifKey: "aktif_siswa", path: "wa-remind-siswa" },
  { tahap: "pulang", jamKey: "jam_pulang", aktifKey: "aktif_pulang", path: "wa-remind-pulang" },
  { tahap: "ortu", jamKey: "jam_ortu", aktifKey: "aktif_ortu", path: "wa-remind-ortu" },
  { tahap: "dudi", jamKey: "jam_dudi", aktifKey: "aktif_dudi", path: "wa-remind-dudi" },
  { tahap: "guru", jamKey: "jam_guru", aktifKey: "aktif_guru", path: "wa-summary-guru" },
] as const;

/** toleransi keterlambatan cron (menit) */
const WINDOW = 9;

export const Route = createFileRoute("/api/public/hooks/wa-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgl = todayWita();
        if (isHolidayToday()) {
          return Response.json({ dispatcher: true, tgl, skipped: "holiday" });
        }
        const settings = await loadWaSettings();
        if (!settings) return Response.json({ dispatcher: true, tgl, skipped: "no_settings" });

        const now = nowWitaMinutes();
        const origin = new URL(request.url).origin;
        const results: any[] = [];

        // Ringkasan rekap ALPA — tetap 09.00 WITA
        {
          const jam = 9 * 60;
          if (now >= jam && now <= jam + WINDOW) {
            try {
              const res = await fetch(`${origin}/api/public/hooks/wa-summary-alpa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              results.push({ tahap: "alpa", status: res.status, body: await res.json().catch(() => null) });
            } catch (e: any) {
              results.push({ tahap: "alpa", error: e?.message ?? String(e) });
            }
          } else {
            results.push({ tahap: "alpa", skipped: "not_due", jam, now });
          }
        }

        // Notifikasi HP guru: siswa absen terlambat (cek tiap kali dispatcher jalan)
        try {
          const res = await fetch(`${origin}/api/public/hooks/push-guru-terlambat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          results.push({ tahap: "guru_terlambat", status: res.status, body: await res.json().catch(() => null) });
        } catch (e: any) {
          results.push({ tahap: "guru_terlambat", error: e?.message ?? String(e) });
        }

        for (const st of STAGES) {
          if (!(settings as any)[st.aktifKey]) {
            results.push({ tahap: st.tahap, skipped: "stage_disabled" });
            continue;
          }
          const jam = parseJamToMinutes((settings as any)[st.jamKey]);
          if (jam === null) {
            results.push({ tahap: st.tahap, skipped: "jam_invalid" });
            continue;
          }
          if (now < jam || now > jam + WINDOW) {
            results.push({ tahap: st.tahap, skipped: "not_due", jam, now });
            continue;
          }
          try {
            const res = await fetch(`${origin}/api/public/hooks/${st.path}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            results.push({ tahap: st.tahap, status: res.status, body: await res.json().catch(() => null) });
          } catch (e: any) {
            results.push({ tahap: st.tahap, error: e?.message ?? String(e) });
          }
        }

        return Response.json({ dispatcher: true, tgl, now_wita_minutes: now, results });
      },
    },
  },
});