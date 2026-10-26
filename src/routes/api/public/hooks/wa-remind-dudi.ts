import { createFileRoute } from "@tanstack/react-router";
import {
  alreadySent,
  getSiswaBelumAbsen,
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

/** 08.30 WITA — kirim pengingat ke pembimbing DUDI */
export const Route = createFileRoute("/api/public/hooks/wa-remind-dudi")({
  server: {
    handlers: {
      POST: async () => {
        if (isHolidayToday()) {
          return Response.json({ tahap: "dudi", skipped: "holiday", tgl: todayWita() });
        }
        const settings = await loadWaSettings();
        if (settings && !settings.aktif_dudi) return Response.json({ tahap: "dudi", skipped: "stage_disabled" });
        const overrides = await loadWaOverrides();
        const list = await getSiswaBelumAbsen();
        const tgl = todayWita();
        let sent = 0, skipped = 0, failed = 0;
        const jedaMs = Math.max(0, Number(settings?.jeda_menit ?? 0)) * 60_000;
        let firstSent = true;
        for (const s of list) {
          const ov = overrides.get(s.id);
          if (ov?.disable_all || ov?.skip_dudi) { skipped++; continue; }
          if (!isDayActiveForSiswa(ov, settings?.hari_aktif ?? [1,2,3,4,5])) { skipped++; continue; }
          if (await alreadySent(s.id, "dudi")) { skipped++; continue; }
          const phone = normalizePhone(s.no_hp_dudi);
          if (!phone) {
            await logReminder(s.id, "dudi", "skipped", "no_hp_dudi kosong / tidak valid");
            skipped++;
            continue;
          }
          const tpl = settings?.template_dudi ??
            `Yth. Pembimbing DUDI {tempat}, siswa {nama} ({kelas}) belum absen PKL hari ini ({tanggal}).`;
          const msg = renderTemplate(tpl, {
            nama: s.nama_siswa ?? "siswa",
            tanggal: tgl,
            kelas: s.kelas ?? "-",
            tempat: s.tempat_magang ?? "-",
          });
          const r = await sendFonnte(phone, msg);
          if (r.ok) { await logReminder(s.id, "dudi", "sent", phone); sent++; }
          else { await logReminder(s.id, "dudi", "failed", r.error); failed++; }
          if (jedaMs > 0 && !firstSent) await sleep(jedaMs);
          firstSent = false;
        }
        return Response.json({ tahap: "dudi", tgl, total: list.length, sent, skipped, failed });
      },
    },
  },
});