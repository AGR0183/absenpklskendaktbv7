import { createFileRoute } from "@tanstack/react-router";
import {
  getGuruPhoneMap,
  getGuruFavoritMap,
  getSiswaTerlambatBaru,
  isHolidayToday,
  loadWaSettings,
  loadWaOverrides,
  isDayActiveForSiswa,
  normalizePhone,
  parseJamToMinutes,
  todayWita,
} from "@/lib/wa.server";
import { sendPushToUser } from "@/lib/push.server";

/** Jendela deteksi (menit) — samakan dengan interval cron dispatcher + toleransi */
const WINDOW = 10;

/**
 * Notifikasi HP ke guru pembimbing saat ada siswa yang absen MASUK terlambat.
 * Dijalankan tiap kali dispatcher berjalan (5 menit sekali).
 */
export const Route = createFileRoute("/api/public/hooks/push-guru-terlambat")({
  server: {
    handlers: {
      POST: async () => {
        const tgl = todayWita();
        if (isHolidayToday()) return Response.json({ tahap: "guru_terlambat", tgl, skipped: "holiday" });

        const settings = await loadWaSettings();
        const batas = parseJamToMinutes(settings?.jam_siswa) ?? 7 * 60 + 30;
        const overrides = await loadWaOverrides();
        const globalHari = settings?.hari_aktif ?? [1, 2, 3, 4, 5];

        const all = await getSiswaTerlambatBaru(batas, WINDOW);
        const list = all.filter((s) => {
          const ov = overrides.get(s.id);
          if (ov?.disable_all || ov?.skip_guru) return false;
          return isDayActiveForSiswa(ov, globalHari);
        });
        if (list.length === 0) {
          return Response.json({ tahap: "guru_terlambat", tgl, total: 0, sent: 0 });
        }

        const guruMap = await getGuruPhoneMap();
        const favMap = await getGuruFavoritMap();
        // kelompokkan per guru — HANYA siswa favorit guru tersebut
        const groups = new Map<string, typeof list>();
        for (const s of list) {
          const ph = normalizePhone(s.no_hp_guru);
          const guru = ph ? guruMap.get(ph) : undefined;
          if (!guru) continue;
          const favs = favMap.get(guru.userId);
          if (!favs?.has(s.id)) continue;
          const arr = groups.get(guru.userId) ?? [];
          arr.push(s);
          groups.set(guru.userId, arr);
        }

        let sent = 0;
        let devices = 0;
        for (const [guruId, arr] of groups) {
          const body =
            arr.length === 1
              ? `${arr[0].nama_siswa ?? "Siswa"} (${arr[0].kelas ?? "-"}) absen masuk pukul ${arr[0].jam} WITA.`
              : arr.map((s) => `${s.nama_siswa ?? "Siswa"} (${s.jam})`).join(", ");
          try {
            const r = await sendPushToUser(guruId, "Siswa absen terlambat", body, "/guru");
            sent += r.sent;
            devices += r.devices;
          } catch {
            /* push opsional */
          }
        }

        return Response.json({ tahap: "guru_terlambat", tgl, total: list.length, guru: groups.size, sent, devices });
      },
    },
  },
});
