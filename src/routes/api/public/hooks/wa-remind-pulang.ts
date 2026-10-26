import { createFileRoute } from "@tanstack/react-router";
import {
  alreadySent,
  getSiswaBelumAbsenPulang,
  logReminder,
  normalizePhone,
  sendFonnte,
  todayWita,
  loadWaSettings,
  loadWaOverrides,
  isDayActiveForSiswa,
  renderTemplate,
  isHolidayToday,
  sleep,
} from "@/lib/wa.server";
import { sendPushToUser } from "@/lib/push.server";

/** Pengingat ke siswa yang sudah absen masuk tapi belum absen pulang */
export const Route = createFileRoute("/api/public/hooks/wa-remind-pulang")({
  server: {
    handlers: {
      POST: async () => {
        if (isHolidayToday()) {
          return Response.json({ tahap: "pulang", skipped: "holiday", tgl: todayWita() });
        }
        const settings = await loadWaSettings();
        if (settings && !(settings as any).aktif_pulang) {
          return Response.json({ tahap: "pulang", skipped: "stage_disabled" });
        }
        const overrides = await loadWaOverrides();
        const list = await getSiswaBelumAbsenPulang();
        const tgl = todayWita();
        let sent = 0, skipped = 0, failed = 0;
        const jedaMs = Math.max(0, Number(settings?.jeda_menit ?? 0)) * 60_000;
        let firstSent = true;
        for (const s of list) {
          const ov = overrides.get(s.id) as any;
          if (ov?.disable_all || ov?.skip_pulang) { skipped++; continue; }
          if (!isDayActiveForSiswa(ov, settings?.hari_aktif ?? [1, 2, 3, 4, 5])) { skipped++; continue; }
          if (await alreadySent(s.id, "pulang")) { skipped++; continue; }
          try {
            await sendPushToUser(
              s.id,
              "Belum absen pulang",
              `Halo ${s.nama_siswa ?? "Siswa"}, Anda belum melakukan absensi PULANG PKL hari ini.`,
              "/beranda",
            );
          } catch { /* push opsional */ }
          const phone = normalizePhone(s.no_hp_siswa);
          if (!phone) {
            await logReminder(s.id, "pulang", "skipped", "no_hp_siswa kosong / tidak valid");
            skipped++;
            continue;
          }
          const tpl = (settings as any)?.template_pulang ??
            `Halo {nama},\n\nAnda belum melakukan absensi PULANG PKL hari ini ({tanggal}).\n\n— SIAP PKL SMKN 2 Kotabaru`;
          const msg = renderTemplate(tpl, {
            nama: s.nama_siswa ?? "Siswa",
            tanggal: tgl,
            kelas: s.kelas ?? "-",
            tempat: s.tempat_magang ?? "-",
          });
          const r = await sendFonnte(phone, msg);
          if (r.ok) { await logReminder(s.id, "pulang", "sent", phone); sent++; }
          else { await logReminder(s.id, "pulang", "failed", r.error); failed++; }
          if (jedaMs > 0 && !firstSent) await sleep(jedaMs);
          firstSent = false;
        }
        return Response.json({ tahap: "pulang", tgl, total: list.length, sent, skipped, failed });
      },
    },
  },
});
