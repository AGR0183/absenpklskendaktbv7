import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { changeMyPin } from "@/lib/auth-pin.functions";
import { updateMyProfileHp } from "@/lib/siswa.functions";
import { getMyWaSchedule, setMyWaHariAktif } from "@/lib/wa-settings.functions";
import logo from "@/assets/logo-smkn2.png";
import { LogOut, KeyRound, Phone, CalendarDays } from "lucide-react";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export const Route = createFileRoute("/_authenticated/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const { profile, user, roles, signOut, refresh } = useAuth();
  const navigate = useNavigate();
  const p = (profile ?? {}) as any;
  const isStaff = roles.includes("admin") || roles.includes("guru");
  const changeFn = useServerFn(changeMyPin);
  const updateHpFn = useServerFn(updateMyProfileHp);
  const getSchedFn = useServerFn(getMyWaSchedule);
  const setSchedFn = useServerFn(setMyWaHariAktif);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [hpSiswa, setHpSiswa] = useState("");
  const [savingHp, setSavingHp] = useState(false);
  const [hariAktif, setHariAktif] = useState<number[] | null>(null);
  const [hariGlobal, setHariGlobal] = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingHari, setSavingHari] = useState(false);

  useEffect(() => {
    if (profile) setHpSiswa(p.no_hp_siswa ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    getSchedFn({})
      .then((r) => {
        setHariAktif(r.hari_aktif);
        setHariGlobal(r.hari_aktif_global);
      })
      .catch(() => {});
  }, [getSchedFn]);

  const effHari = hariAktif ?? hariGlobal;
  const toggleHari = (d: number) => {
    const base = hariAktif ?? hariGlobal;
    const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort();
    setHariAktif(next);
  };

  const saveHari = async () => {
    setSavingHari(true);
    try {
      await setSchedFn({ data: { hari_aktif: hariAktif } });
      toast.success("Hari notifikasi disimpan");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setSavingHari(false);
    }
  };

  const resetHari = async () => {
    setSavingHari(true);
    try {
      await setSchedFn({ data: { hari_aktif: null } });
      setHariAktif(null);
      toast.success("Mengikuti pengaturan global");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setSavingHari(false);
    }
  };

  const submitHp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHp(true);
    try {
      await updateHpFn({ data: { no_hp_siswa: hpSiswa.trim() || null } });
      toast.success("Nomor HP tersimpan");
      await refresh();
    } catch (e: any) {
      toast.error("Gagal menyimpan", { description: e?.message });
    } finally {
      setSavingHp(false);
    }
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await changeFn({ data: { newPin: pin } });
      toast.success("PIN berhasil diubah");
      setPin("");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <div className="flex flex-col items-center gap-2 mb-6">
        <img src={logo} alt="Logo" className="w-20 h-20 object-contain" />
        <h1 className="text-lg font-extrabold">{profile?.nama_siswa}</h1>
        <div className="flex gap-1.5 mt-1">
          {roles.map((r) => (
            <span key={r} className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full uppercase font-bold">{r}</span>
          ))}
        </div>
      </div>
      {!isStaff && (
      <div className="bg-card rounded-xl p-4 space-y-3 border border-border">
        <Row label="Kelas" value={profile?.kelas ?? "-"} />
        <Row label="Tempat Magang" value={profile?.tempat_magang ?? "-"} />
        <Row label="No. HP Orang Tua" value={p.no_hp_ortu ?? "-"} />
        <Row label="No. HP Guru Pembimbing" value={p.no_hp_guru ?? "-"} />
        <Row label="No. HP Pembimbing DUDI" value={p.no_hp_dudi ?? "-"} />
        <p className="text-[10px] text-muted-foreground italic">Nomor HP Orang Tua, Guru, dan DUDI hanya dapat diubah oleh admin.</p>
      </div>
      )}
      {!isStaff && (
      <Button variant="outline" className="w-full mt-4" onClick={() => navigate({ to: "/setup-profil" })}>
        Ubah Data
      </Button>
      )}
      {!isStaff && (
      <form onSubmit={submitHp} className="mt-4 bg-card rounded-xl p-4 border border-border space-y-3">
        <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><h3 className="font-bold text-sm">Nomor HP Siswa</h3></div>
        <div className="space-y-1.5">
          <Label htmlFor="hp_siswa" className="text-xs">No. HP Siswa</Label>
          <Input id="hp_siswa" inputMode="tel" maxLength={20} placeholder="08xxxxxxxxxx" value={hpSiswa} onChange={(e) => setHpSiswa(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={savingHp} className="w-full">{savingHp ? "Menyimpan…" : "Simpan Nomor HP"}</Button>
      </form>
      )}
      <div className="mt-4 bg-card rounded-xl p-4 border border-border space-y-3">
        <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /><h3 className="font-bold text-sm">Hari Aktif Notifikasi WA</h3></div>
        <p className="text-[11px] text-muted-foreground">
          Pilih hari saat Anda ingin menerima pengingat WhatsApp jika belum absen.
          {hariAktif === null && <> Saat ini mengikuti pengaturan global ({hariGlobal.map((d) => HARI[d]).join(", ") || "—"}).</>}
        </p>
        <div className="flex flex-wrap gap-1">
          {HARI.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleHari(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${effHari.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={saveHari} disabled={savingHari} className="flex-1">{savingHari ? "Menyimpan…" : "Simpan"}</Button>
          {hariAktif !== null && (
            <Button type="button" size="sm" variant="outline" onClick={resetHari} disabled={savingHari}>Ikuti Global</Button>
          )}
        </div>
      </div>
      <form onSubmit={submitPin} className="mt-4 bg-card rounded-xl p-4 border border-border space-y-2">
        <div className="flex items-center gap-2"><KeyRound className="w-4 h-4" /><h3 className="font-bold text-sm">Ubah PIN</h3></div>
        <p className="text-[11px] text-muted-foreground">PIN 4–6 digit. Default <b>1234</b>.</p>
        <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN baru" required minLength={4} className="text-center tracking-[0.4em]" />
        <Button type="submit" size="sm" disabled={busy || pin.length < 4} className="w-full">{busy ? "Menyimpan…" : "Simpan PIN"}</Button>
      </form>
      <Button variant="destructive" className="w-full mt-2 gap-2" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
        <LogOut className="w-4 h-4" /> Keluar
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}