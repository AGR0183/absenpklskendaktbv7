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
  type MissingSiswa,
  isHolidayToday,
  sleep,
  getGuruPhoneMap,
  getGuruFavoritMap,
} from "@/lib/wa.server";
import { sendPushToUser } from "@/lib/push.server";

/** 09.00 WITA — kirim ringkasan ke guru pembimbing (dikelompokkan per nomor guru) */
export const Route = createFileRoute("/api/public/hooks/wa-summary-guru")({
  server: {
    handlers: {
      POST: async () => {
        if (isHolidayToday()) {
          return Response.json({ tahap: "guru", skipped: "holiday", tgl: todayWita() });
        }
        const settings = await loadWaSettings();
        if (settings && !settings.aktif_guru) return Response.json({ tahap: "guru", skipped: "stage_disabled" });
        const overrides = await loadWaOverrides();
        const allList = await getSiswaBelumAbsen();
        const globalHari = settings?.hari_aktif ?? [1,2,3,4,5];
        const list = allList.filter((s) => {
          const ov = overrides.get(s.id);
          if (ov?.disable_all || ov?.skip_guru) return false;
          return isDayActiveForSiswa(ov, globalHari);
        });
        const tgl = todayWita();

        // Kelompokkan per nomor guru pembimbing
        const groups = new Map<string, MissingSiswa[]>();
        const noPhoneSiswa: MissingSiswa[] = [];
        for (const s of list) {
          const phone = normalizePhone(s.no_hp_guru);
          if (!phone) { noPhoneSiswa.push(s); continue; }
          if (!groups.has(phone)) groups.set(phone, []);
          groups.get(phone)!.push(s);
        }

        const guruMap = await getGuruPhoneMap();
        const favMap = await getGuruFavoritMap();
        let sent = 0, skipped = 0, failed = 0;
        let pushSent = 0;
        const jedaMs = Math.max(0, Number(settings?.jeda_menit ?? 0)) * 60_000;
        let firstSent = true;

        for (const [phone, siswaList] of groups) {
          // tandai per-siswa supaya tidak dobel kalau cron jalan ulang
          const toSend = [] as MissingSiswa[];
          for (const s of siswaList) {
            if (await alreadySent(s.id, "guru")) { skipped++; continue; }
            toSend.push(s);
          }
          if (toSend.length === 0) continue;

          const daftar = toSend.map((s, i) =>
            `${i + 1}. ${s.nama_siswa ?? "(tanpa nama)"} — ${s.kelas ?? "-"} @ ${s.tempat_magang ?? "-"}`,
          ).join("\n");
          const tpl = settings?.template_guru ??
            `Ringkasan siswa PKL belum absen ({tanggal}):\n\n{daftar}`;
          const msg = renderTemplate(tpl, { tanggal: tgl, daftar });

          // Notifikasi HP ke guru pembimbing — HANYA untuk siswa favoritnya
          const guru = guruMap.get(phone);
          if (guru) {
            const favs = favMap.get(guru.userId);
            const pushList = favs ? toSend.filter((s) => favs.has(s.id)) : [];
            if (pushList.length > 0) {
              try {
                const pr = await sendPushToUser(
                  guru.userId,
                  `${pushList.length} siswa favorit belum absen`,
                  pushList.map((s) => s.nama_siswa ?? "(tanpa nama)").join(", "),
                  "/guru",
                );
                pushSent += pr.sent;
              } catch { /* push opsional */ }
            }
          }

          const r = await sendFonnte(phone, msg);
          for (const s of toSend) {
            if (r.ok) { await logReminder(s.id, "guru", "sent", phone); sent++; }
            else { await logReminder(s.id, "guru", "failed", r.error); failed++; }
          }
          if (jedaMs > 0 && !firstSent) await sleep(jedaMs);
          firstSent = false;
        }

        for (const s of noPhoneSiswa) {
          if (await alreadySent(s.id, "guru")) { skipped++; continue; }
          await logReminder(s.id, "guru", "skipped", "no_hp_guru kosong / tidak valid");
          skipped++;
        }

        return Response.json({ tahap: "guru", tgl, total: list.length, sent, skipped, failed, pushSent, groups: groups.size });
      },
    },
  },
});