import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getBelumAbsenHariIni } from "@/lib/rekap.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, RefreshCw, CalendarX } from "lucide-react";

type Row = { id: string; nama: string; kelas: string | null; tempat: string | null };
type Tab = "masuk" | "pulang";

export function BelumAbsenCard() {
  const fetchBelum = useServerFn(getBelumAbsenHariIni);
  const [belumMasuk, setBelumMasuk] = useState<Row[]>([]);
  const [belumPulang, setBelumPulang] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("masuk");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q, 350);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchBelum({});
      const today = res.today ?? [];
      const sudahMasuk = new Set(
        today
          .filter((a) => ["masuk", "izin", "sakit"].includes(a.jenis))
          .map((a) => a.user_id),
      );
      const sudahPulang = new Set(
        today
          .filter((a) => ["pulang", "izin", "sakit"].includes(a.jenis))
          .map((a) => a.user_id),
      );
      const map = (p: any): Row => ({
        id: p.id,
        nama: p.nama_siswa ?? "-",
        kelas: p.kelas,
        tempat: p.tempat_magang,
      });
      const profs = res.profiles ?? [];
      setBelumMasuk(profs.filter((p: any) => !sudahMasuk.has(p.id)).map(map));
      setBelumPulang(profs.filter((p: any) => !sudahPulang.has(p.id)).map(map));
    } catch {
      setBelumMasuk([]);
      setBelumPulang([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = tab === "masuk" ? belumMasuk : belumPulang;

  const filtered = useMemo(() => {
    const t = qDebounced.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.nama, r.kelas ?? "", r.tempat ?? ""].some((v) => v.toLowerCase().includes(t)),
    );
  }, [rows, qDebounced]);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-bold text-sm flex items-center gap-1.5">
          <CalendarX className="w-4 h-4 text-destructive" />
          Siswa Belum Absen Hari Ini
        </h2>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Muat ulang
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1 mb-2 p-1 rounded-lg bg-muted">
        <button
          type="button"
          onClick={() => setTab("masuk")}
          className={`h-7 rounded-md text-xs font-semibold transition ${tab === "masuk" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          Belum Masuk ({belumMasuk.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("pulang")}
          className={`h-7 rounded-md text-xs font-semibold transition ${tab === "pulang" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          Belum Pulang ({belumPulang.length})
        </button>
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input placeholder="Cari nama / kelas / tempat PKL…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 pl-7 text-xs" />
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {loading && <p className="text-xs text-muted-foreground py-3 text-center">Memuat…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">
            Semua siswa sudah absen {tab} hari ini 🎉
          </p>
        )}
        {filtered.map((r) => (
          <Link
            key={r.id}
            to="/rekap/$userId"
            params={{ userId: r.id }}
            className="block px-3 py-2 rounded-lg border border-border hover:bg-muted transition"
          >
            <div className="text-xs font-semibold truncate">{r.nama}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {[r.kelas, r.tempat].filter(Boolean).join(" • ") || "-"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
