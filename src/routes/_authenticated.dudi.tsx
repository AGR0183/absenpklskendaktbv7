import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRekapDudi } from "@/lib/dudi.functions";
import { changeDudiPin } from "@/lib/dudi-auth.functions";
import { formatJamShort, todayISO } from "@/lib/format";
import { hitungKehadiran, formatHari, formatPersen } from "@/lib/kehadiran";
import { Building2, LogOut, Search, ChevronRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo-smkn2.png";

export const Route = createFileRoute("/_authenticated/dudi")({
  component: DudiDashboard,
});

type Prof = { id: string; nama_siswa: string | null; kelas: string | null; tempat_magang: string | null };
type Att = { id: string; user_id: string; jenis: string; tanggal: string; waktu: string; nama_lokasi: string | null; photo_url: string | null };

function DudiDashboard() {
  const fetchRekap = useServerFn(getRekapDudi);
  const doChangePin = useServerFn(changeDudiPin);
  const { signOut } = useAuth();
  const [tempat, setTempat] = useState("");
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchRekap({})
      .then((r) => {
        setTempat(r.tempat);
        setProfiles(r.profiles as Prof[]);
        setAtt(r.attendance as Att[]);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayISO();

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return profiles
      .filter((p) => (!t ? true : [p.nama_siswa ?? "", p.kelas ?? ""].some((v) => v.toLowerCase().includes(t))))
      .map((p) => {
        const mine = att.filter((a) => a.user_id === p.id);
        const k = hitungKehadiran(mine);
        const hariIni = mine.filter((a) => a.tanggal === today);
        const pick = (j: string) => hariIni.find((a) => a.jenis === j) ?? null;
        return {
          p,
          k,
          izin: mine.filter((a) => a.jenis === "izin").length,
          sakit: mine.filter((a) => a.jenis === "sakit").length,
          masuk: pick("masuk"),
          pulang: pick("pulang"),
          izinHariIni: pick("izin") ?? pick("sakit"),
        };
      });
  }, [profiles, att, search, today]);

  const submitPin = async () => {
    if (!/^[0-9]{4,6}$/.test(pin1)) return toast.error("PIN harus 4-6 digit angka");
    if (pin1 !== pin2) return toast.error("Konfirmasi PIN tidak sama");
    setBusy(true);
    try {
      await doChangePin({ data: { newPin: pin1 } });
      toast.success("PIN berhasil diubah");
      setPinOpen(false);
      setPin1("");
      setPin2("");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Logo" className="w-10 h-10" />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Dasbor DUDI</p>
            <p className="text-sm font-extrabold leading-tight">SMKN 2 Kotabaru</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setPinOpen(true)}>
            <KeyRound className="w-4 h-4 mr-1" /> PIN
          </Button>
          <Button size="sm" variant="ghost" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-1" /> Keluar
          </Button>
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-4 text-white" style={{ background: "var(--gradient-brand)" }}>
        <p className="text-xs opacity-90 uppercase tracking-wider font-bold flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" /> Tempat Magang
        </p>
        <p className="text-lg font-extrabold mt-0.5">{tempat || "…"}</p>
        <p className="text-[11px] opacity-90 mt-1">{loading ? "Memuat…" : `${profiles.length} siswa PKL terdaftar`}</p>
      </div>

      {err && <p className="text-sm text-destructive mb-3">{err}</p>}

      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Cari nama / kelas…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-7 text-sm" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-border text-xs font-bold">Absen Hari Ini</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[420px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Nama</th>
                <th className="text-left px-2 py-2 font-semibold">Masuk</th>
                <th className="text-left px-2 py-2 font-semibold">Pulang</th>
                <th className="text-left px-2 py-2 font-semibold">Ket.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-semibold truncate max-w-[160px]">{r.p.nama_siswa ?? "-"}</div>
                    <div className="text-[10px] text-muted-foreground">{r.p.kelas ?? "-"}</div>
                  </td>
                  <td className="px-2 py-2">{r.masuk ? `${formatJamShort(r.masuk.waktu)} Wita` : "—"}</td>
                  <td className="px-2 py-2">{r.pulang ? `${formatJamShort(r.pulang.waktu)} Wita` : "—"}</td>
                  <td className="px-2 py-2 capitalize">{r.izinHariIni ? r.izinHariIni.jenis : "—"}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Belum ada siswa.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.p.id}
            to="/rekap/$userId"
            params={{ userId: r.p.id }}
            className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary transition"
          >
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{r.p.nama_siswa ?? "-"}</div>
              <div className="text-[11px] text-muted-foreground">{r.p.kelas ?? "-"}</div>
              <div className="text-[11px] mt-1">
                Hadir <b>{formatHari(r.k.hadir)}</b>/{r.k.totalHari} hari · {formatPersen(r.k.persen)} · Izin {r.izin} · Sakit {r.sakit}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Ubah PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN baru (4-6 digit)" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ""))} />
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="Ulangi PIN baru" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
          </div>
          <DialogFooter>
            <Button onClick={submitPin} disabled={busy} className="w-full">{busy ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}