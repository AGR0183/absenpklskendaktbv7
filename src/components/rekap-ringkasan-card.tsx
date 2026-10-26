import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRekapRingkas } from "@/lib/rekap.functions";
import { hitungKehadiran, formatPersen } from "@/lib/kehadiran";
import { makeIsLibur, type JadwalKerja } from "@/lib/libur";

type Counts = Record<"masuk" | "pulang" | "izin" | "sakit", number>;

export function RekapRingkasanCard() {
  const fetchRingkas = useServerFn(getRekapRingkas);
  const [counts, setCounts] = useState<Counts>({ masuk: 0, pulang: 0, izin: 0, sakit: 0 });
  const [persen, setPersen] = useState(0);
  const [jumlahSiswa, setJumlahSiswa] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await fetchRingkas({});
        if (!alive) return;
        const att = res.attendance ?? [];
        const jadwal = (res.jadwal ?? {}) as Record<string, JadwalKerja>;
        const hariGlobal = res.hariAktifGlobal ?? [1, 2, 3, 4, 5, 6];
        const ids = new Set((res.siswaIds ?? []) as string[]);

        const c: Counts = { masuk: 0, pulang: 0, izin: 0, sakit: 0 };
        const byUser = new Map<string, { jenis: string; tanggal: string }[]>();
        for (const a of att) {
          if (!ids.has(a.user_id)) continue;
          if (a.jenis in c) c[a.jenis as keyof Counts] += 1;
          if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
          byUser.get(a.user_id)!.push({ jenis: a.jenis, tanggal: a.tanggal });
        }
        let sum = 0;
        let n = 0;
        for (const [uid, list] of byUser) {
          const k = hitungKehadiran(list, makeIsLibur(jadwal[uid], hariGlobal));
          if (k.totalHari > 0) {
            sum += k.persen;
            n += 1;
          }
        }
        setCounts(c);
        setJumlahSiswa(n);
        setPersen(n > 0 ? sum / n : 0);
      } catch {
        /* abaikan */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-4">
      <div className="grid grid-cols-4 gap-2 mb-3">
        {(["masuk", "pulang", "izin", "sakit"] as const).map((j) => (
          <div key={j} className="rounded-xl border border-border bg-card p-2 text-center">
            <p className="text-lg font-extrabold leading-tight">{counts[j]}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{j}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Rata-rata Kehadiran
          </p>
          <p className="text-2xl font-extrabold text-primary">{formatPersen(persen)}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, persen)}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {loading ? "Memuat…" : `${jumlahSiswa} siswa. masuk+pulang = 1 hari, hanya masuk = 0,5 hari.`}
        </p>
      </div>
    </div>
  );
}
