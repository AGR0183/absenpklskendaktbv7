import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAnak, addAnak, removeAnak, changePinOrtu } from "@/lib/ortu.functions";
import { getLoginCandidates, type LoginCandidate } from "@/lib/auth-pin.functions";
import { Baby, LogOut, MapPin, ChevronRight, Plus, Search, X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-smkn2.png";

export const Route = createFileRoute("/_authenticated/ortu/")({
  component: OrtuDashboard,
});

type Anak = { user_id: string; nama: string; kelas: string | null; tempat_magang: string | null };

function OrtuDashboard() {
  const navigate = useNavigate();
  const fetchAnak = useServerFn(listAnak);
  const doAdd = useServerFn(addAnak);
  const doRemove = useServerFn(removeAnak);
  const doChangePin = useServerFn(changePinOrtu);
  const fetchCandidates = useServerFn(getLoginCandidates);
  const [anak, setAnak] = useState<Anak[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { signOut } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<LoginCandidate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pilihPinOpen, setPilihPinOpen] = useState(false);
  const [pinAnak, setPinAnak] = useState<Anak | null>(null);
  const [pinLama, setPinLama] = useState("");
  const [pinBaru, setPinBaru] = useState("");
  const [pinUlang, setPinUlang] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      // Pastikan sesi siap sebelum memanggil server function (butuh bearer token)
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        await new Promise((r) => setTimeout(r, 400));
        ({ data } = await supabase.auth.getSession());
      }
      if (!data.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const r = await fetchAnak({});
      setAnak(r.anak);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = async () => {
    setAddOpen(true);
    setSearch("");
    if (candidates.length === 0) {
      setLoadingList(true);
      try {
        const res = await fetchCandidates({ data: { role: "siswa" } });
        setCandidates(res.rows);
      } catch (e: any) {
        toast.error("Gagal memuat daftar", { description: e?.message });
      } finally {
        setLoadingList(false);
      }
    }
  };

  const linkedIds = useMemo(() => new Set(anak.map((a) => a.user_id)), [anak]);
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return candidates
      .filter((c) => !linkedIds.has(c.user_id))
      .filter((c) =>
        !t
          ? true
          : [c.nama, c.kelas ?? ""].some((v) => v.toLowerCase().includes(t)),
      );
  }, [candidates, search, linkedIds]);

  const handleAdd = async (c: LoginCandidate) => {
    setBusyId(c.user_id);
    try {
      await doAdd({ data: { siswaUserId: c.user_id } });
      toast.success(`${c.nama} ditambahkan`);
      setAddOpen(false);
      reload();
    } catch (e: any) {
      toast.error("Gagal menambah anak", { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (a: Anak) => {
    if (!confirm(`Lepas tautan ${a.nama} dari akun Anda?`)) return;
    setBusyId(a.user_id);
    try {
      await doRemove({ data: { siswaUserId: a.user_id } });
      toast.success("Tautan dilepas");
      reload();
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleChangePin = async () => {
    if (!pinAnak) return;
    if (!/^\d{4}$/.test(pinLama) || !/^\d{4}$/.test(pinBaru)) {
      toast.error("PIN harus 4 angka");
      return;
    }
    if (pinBaru !== pinUlang) {
      toast.error("Konfirmasi PIN baru tidak sama");
      return;
    }
    setSavingPin(true);
    try {
      await doChangePin({ data: { siswaUserId: pinAnak.user_id, pinLama, pinBaru } });
      toast.success("PIN berhasil diubah");
      setPinOpen(false);
      setPinLama("");
      setPinBaru("");
      setPinUlang("");
      setPinAnak(null);
    } catch (e: any) {
      toast.error("Gagal mengubah PIN", { description: e?.message });
    } finally {
      setSavingPin(false);
    }
  };

  const openPin = (a: Anak) => {
    setPinAnak(a);
    setPinLama("");
    setPinBaru("");
    setPinUlang("");
    setPilihPinOpen(false);
    setPinOpen(true);
  };

  return (
    <div className="max-w-md mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Logo" className="w-10 h-10" />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Dasbor Orang Tua</p>
            <p className="text-sm font-extrabold leading-tight">SMKN 2 Kotabaru</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (anak.length === 1) {
                openPin(anak[0]);
              } else if (anak.length > 1) {
                setPilihPinOpen(true);
              } else {
                toast.info("Belum ada anak yang tertaut");
              }
            }}
            className="text-xs px-2"
          >
            <KeyRound className="w-4 h-4 mr-1" /> Ubah PIN
          </Button>
          <Button size="sm" variant="ghost" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-1" /> Keluar
          </Button>
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-5 text-white" style={{ background: "var(--gradient-brand)" }}>
        <p className="text-xs opacity-90 uppercase tracking-wider font-bold">Anak Saya</p>
        <p className="text-lg font-extrabold mt-0.5">{loading ? "…" : anak.length} anak terhubung</p>
        <p className="text-[11px] opacity-90 mt-1">Klik salah satu anak untuk melihat rekap absen.</p>
      </div>

      <Button
        type="button"
        onClick={openAdd}
        className="w-full mb-3 gap-2"
        style={{ background: "var(--gradient-brand)" }}
      >
        <Plus className="w-4 h-4" /> Tambah Anak
      </Button>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Memuat…</p>}
      {err && <p className="text-sm text-destructive text-center py-4">{err}</p>}
      {!loading && !err && anak.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Belum ada anak yang tertaut. Klik <b>Tambah Anak</b> untuk menautkan.
        </p>
      )}

      <div className="space-y-2">
        {anak.map((a) => (
          <div key={a.user_id} className="flex items-center gap-2">
            <Link
              to="/ortu/$siswaId"
              params={{ siswaId: a.user_id }}
              onClick={() => { try { localStorage.setItem("ortu_active_siswa", a.user_id); } catch { /* ignore */ } }}
              className="flex-1 flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Baby className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{a.nama}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {a.kelas ?? "-"}
                  {a.tempat_magang ? ` • ${a.tempat_magang}` : ""}
                </p>
                {a.tempat_magang && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {a.tempat_magang}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <div className="shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busyId === a.user_id}
                onClick={() => handleRemove(a)}
                aria-label={`Lepas ${a.nama}`}
                className="text-muted-foreground hover:text-destructive h-9 w-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah PIN Orang Tua</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium -mt-2">{pinAnak?.nama}</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">PIN Lama</label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={pinLama}
                onChange={(e) => setPinLama(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">PIN Baru</label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={pinBaru}
                onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Ulangi PIN Baru</label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={pinUlang}
                onChange={(e) => setPinUlang(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
              />
            </div>
            <Button className="w-full" disabled={savingPin} onClick={handleChangePin}>
              {savingPin ? "Menyimpan…" : "Simpan PIN"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              PIN ini dipakai saat login sebagai Orang Tua dari anak tersebut.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pilihPinOpen} onOpenChange={setPilihPinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih Anak</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Pilih anak yang PIN-nya ingin diubah.</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {anak.map((a) => (
              <button
                key={a.user_id}
                type="button"
                onClick={() => openPin(a)}
                className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition"
              >
                <div className="text-sm font-semibold">{a.nama}</div>
                <div className="text-[10px] text-muted-foreground">{a.kelas ?? "-"}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Anak</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Cari nama / kelas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-7 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
            {loadingList && (
              <p className="text-xs text-center text-muted-foreground py-4">Memuat…</p>
            )}
            {!loadingList && filtered.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-4">
                Tidak ada siswa yang cocok.
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={c.user_id}
                type="button"
                disabled={busyId === c.user_id}
                onClick={() => handleAdd(c)}
                className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition disabled:opacity-60"
              >
                <div className="text-sm font-semibold truncate">{c.nama}</div>
                {c.kelas && <div className="text-[10px] text-muted-foreground">{c.kelas}</div>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}