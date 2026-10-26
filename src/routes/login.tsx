import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import logo from "@/assets/logo-smkn2.png";
import { hasAnyAdmin, bootstrapFirstAdmin } from "@/lib/siswa.functions";
import { getLoginCandidates, loginWithPin, type LoginCandidate } from "@/lib/auth-pin.functions";
import { loginOrtuBySiswa } from "@/lib/ortu-auth.functions";
import { listDudiTempat, loginDudi, type DudiTempat } from "@/lib/dudi-auth.functions";
import { GraduationCap, UserCog, ShieldCheck, ChevronLeft, Search, Users, Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Role = "siswa" | "guru" | "admin";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading, isAdmin, isGuruOnly, isOrtu, isDudi } = useAuth();
  const [busy, setBusy] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [bForm, setBForm] = useState({ username: "", password: "", nama: "" });
  const checkAdmin = useServerFn(hasAnyAdmin);
  const createAdmin = useServerFn(bootstrapFirstAdmin);
  const fetchCandidates = useServerFn(getLoginCandidates);
  const doLogin = useServerFn(loginWithPin);
  const doOrtuLogin = useServerFn(loginOrtuBySiswa);
  const fetchDudi = useServerFn(listDudiTempat);
  const doDudiLogin = useServerFn(loginDudi);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [candidates, setCandidates] = useState<LoginCandidate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<LoginCandidate | null>(null);
  const [pin, setPin] = useState("");
  // Mode ortu: menampilkan daftar siswa untuk dipilih tanpa PIN.
  const [ortuMode, setOrtuMode] = useState(false);
  // Mode DUDI: pilih tempat magang lalu isi PIN.
  const [dudiMode, setDudiMode] = useState(false);
  const [dudiList, setDudiList] = useState<DudiTempat[]>([]);
  const [dudiPicked, setDudiPicked] = useState<DudiTempat | null>(null);

  useEffect(() => {
    if (!loading && session) {
      if (isOrtu) {
        navigate({ to: "/ortu" });
        return;
      }
      navigate({
        to: isDudi ? "/dudi" : isAdmin ? "/admin" : isGuruOnly ? "/rekap-semua" : "/beranda",
      });
    }
  }, [session, loading, navigate, isAdmin, isGuruOnly, isOrtu, isDudi]);

  useEffect(() => {
    checkAdmin({}).then((r) => setAdminExists(r.exists)).catch(() => setAdminExists(true));
  }, [checkAdmin]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return candidates;
    return candidates.filter((c) =>
      [c.nama, c.kelas ?? ""].some((v) => v.toLowerCase().includes(t)),
    );
  }, [candidates, search]);

  const pickRole = async (r: Role) => {
    setRole(r);
    setStep(2);
    setOrtuMode(false);
    setDudiMode(false);
    setSearch("");
    setPicked(null);
    setPin("");
    setLoadingList(true);
    try {
      const res = await fetchCandidates({ data: { role: r } });
      setCandidates(res.rows);
    } catch (e: any) {
      toast.error("Gagal memuat daftar", { description: e?.message });
    } finally {
      setLoadingList(false);
    }
  };

  const startOrtu = async () => {
    setRole(null);
    setOrtuMode(true);
    setDudiMode(false);
    setSearch("");
    setPicked(null);
    setLoadingList(true);
    try {
      const res = await fetchCandidates({ data: { role: "siswa" } });
      setCandidates(res.rows);
    } catch (e: any) {
      toast.error("Gagal memuat daftar", { description: e?.message });
    } finally {
      setLoadingList(false);
    }
  };

  const startDudi = async () => {
    setRole(null);
    setOrtuMode(false);
    setDudiMode(true);
    setSearch("");
    setDudiPicked(null);
    setPin("");
    setLoadingList(true);
    try {
      const res = await fetchDudi({});
      setDudiList(res.rows);
    } catch (e: any) {
      toast.error("Gagal memuat daftar tempat magang", { description: e?.message });
    } finally {
      setLoadingList(false);
    }
  };

  const filteredDudi = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return dudiList;
    return dudiList.filter((d) => d.nama.toLowerCase().includes(t));
  }, [dudiList, search]);

  const submitDudiPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dudiPicked) return;
    setBusy(true);
    try {
      const { token_hash } = await doDudiLogin({ data: { tempat: dudiPicked.nama, pin } });
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
      if (error) throw new Error(error.message);
      toast.success(`Selamat datang, ${dudiPicked.nama}!`);
      navigate({ to: "/dudi" });
    } catch (e: any) {
      toast.error("Login gagal", { description: e?.message ?? "PIN salah" });
    } finally {
      setBusy(false);
    }
  };

  const loginAsOrtu = async (c: LoginCandidate) => {
    setBusy(true);
    try {
      const { token_hash, siswaUserId } = await doOrtuLogin({
        data: { siswaUserId: c.user_id, pin },
      });
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
      if (error) throw new Error(error.message);
      try { localStorage.setItem("ortu_active_siswa", siswaUserId); } catch { /* ignore */ }
      toast.success(`Selamat datang, Orang Tua ${c.nama}!`);
      navigate({ to: "/ortu" });
    } catch (e: any) {
      toast.error("Login gagal", { description: e?.message ?? "PIN salah" });
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !picked) return;
    setBusy(true);
    try {
      const { token_hash } = await doLogin({ data: { role, user_id: picked.user_id, pin } });
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
      if (error) throw new Error(error.message);
      toast.success(`Selamat datang, ${picked.nama}!`);
      navigate({ to: role === "guru" ? "/rekap-semua" : role === "admin" ? "/admin" : "/beranda" });
    } catch (e: any) {
      toast.error("Login gagal", { description: e?.message ?? "PIN salah" });
    } finally {
      setBusy(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createAdmin({ data: { username: bForm.username, password: bForm.password, nama_lengkap: bForm.nama } });
      toast.success("Admin pertama dibuat. PIN default: 1234");
      setShowBootstrap(false);
      setAdminExists(true);
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-8" style={{ background: "var(--gradient-soft)" }}>
      <div className="flex flex-col items-center gap-2 mb-6 mt-6">
        <img src={logo} alt="Logo" className="w-20 h-20 object-contain" />
        <h1 className="text-2xl font-extrabold text-center leading-tight">SIAP PKL</h1>
        <p className="text-[10px] font-medium text-primary text-center max-w-[260px] leading-snug">
          Sistem Informasi Absensi dan Pemantauan
          <br />
          Praktik Kerja Lapangan
        </p>
        <p className="text-sm font-semibold text-primary text-center">SMKN 2 Kotabaru</p>
      </div>
      {!showBootstrap ? (
        <div className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-4 border border-border">
          {step === 1 && !ortuMode && !dudiMode && (
            <>
              <h2 className="text-center font-bold text-sm">Masuk sebagai</h2>
              <div className="grid gap-3">
                <RoleButton icon={<GraduationCap className="w-6 h-6" />} label="Siswa" desc="Peserta PKL" onClick={() => pickRole("siswa")} />
                <RoleButton icon={<UserCog className="w-6 h-6" />} label="Guru Pembimbing" desc="Memantau & merekap" onClick={() => pickRole("guru")} />
                <RoleButton icon={<ShieldCheck className="w-6 h-6" />} label="Admin, Kepsek & Kasubbag TU" desc="Mengelola sistem" onClick={() => pickRole("admin")} />
                <RoleButton icon={<Users className="w-6 h-6" />} label="Orang Tua" desc="Memantau absen anak" onClick={startOrtu} />
                <RoleButton icon={<Building2 className="w-6 h-6" />} label="Dunia Usaha & Dunia Industri" desc="Memantau absen siswa PKL" onClick={startDudi} />
              </div>
            </>
          )}
          {dudiMode && !dudiPicked && (
            <>
              <button type="button" onClick={() => setDudiMode(false)} className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Kembali
              </button>
              <h2 className="text-center font-bold text-sm">Pilih Tempat Magang</h2>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Cari tempat magang…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-7 text-sm" />
              </div>
              <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
                {loadingList && <p className="text-xs text-center text-muted-foreground py-4">Memuat…</p>}
                {!loadingList && filteredDudi.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-4">Tidak ada data.</p>
                )}
                {filteredDudi.map((d) => (
                  <button
                    key={d.nama}
                    type="button"
                    onClick={() => { setDudiPicked(d); setPin(""); }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition"
                  >
                    <div className="text-sm font-semibold truncate">{d.nama}</div>
                    <div className="text-[10px] text-muted-foreground">{d.jumlah} siswa PKL</div>
                  </button>
                ))}
              </div>
            </>
          )}
          {dudiMode && dudiPicked && (
            <form onSubmit={submitDudiPin} className="space-y-3">
              <button type="button" onClick={() => setDudiPicked(null)} className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Ganti tempat
              </button>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Dunia Usaha & Dunia Industri</div>
                <div className="font-bold">{dudiPicked.nama}</div>
                <div className="text-[11px] text-muted-foreground">{dudiPicked.jumlah} siswa PKL</div>
              </div>
              <div>
                <label className="text-xs font-semibold">PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  required
                  className="text-center tracking-[0.5em] text-lg h-12"
                  placeholder="••••"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                  PIN standar: <b>1234</b> · dapat diubah setelah masuk
                </p>
              </div>
              <Button type="submit" disabled={busy || pin.length < 4} className="w-full" style={{ background: "var(--gradient-brand)" }}>
                {busy ? "Memproses…" : "Masuk"}
              </Button>
            </form>
          )}
          {ortuMode && !picked && (
            <>
              <button type="button" onClick={() => setOrtuMode(false)} className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Kembali
              </button>
              <h2 className="text-center font-bold text-sm">Pilih Nama Anak</h2>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Cari nama…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-7 text-sm" />
              </div>
              <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
                {loadingList && <p className="text-xs text-center text-muted-foreground py-4">Memuat…</p>}
                {!loadingList && filtered.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-4">Tidak ada data.</p>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.user_id}
                    type="button"
                    disabled={busy}
                    onClick={() => { setPicked(c); setPin(""); }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition disabled:opacity-60"
                  >
                    <div className="text-sm font-semibold truncate">{c.nama}</div>
                    {c.kelas && <div className="text-[10px] text-muted-foreground">{c.kelas}</div>}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Pilih nama anak Anda, lalu masukkan PIN Orang Tua.
              </p>
            </>
          )}
          {ortuMode && picked && (
            <form
              onSubmit={(e) => { e.preventDefault(); loginAsOrtu(picked); }}
              className="space-y-3"
            >
              <button type="button" onClick={() => { setPicked(null); setPin(""); }} className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Ganti nama anak
              </button>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Orang Tua dari</div>
                <div className="font-bold">{picked.nama}</div>
                {picked.kelas && <div className="text-[11px] text-muted-foreground">{picked.kelas}</div>}
              </div>
              <div>
                <label className="text-xs font-semibold">PIN Orang Tua</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  required
                  className="text-center tracking-[0.5em] text-lg h-12"
                  placeholder="••••"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                  PIN standar: <b>1122</b> · hanya admin yang dapat mengubahnya
                </p>
              </div>
              <Button type="submit" disabled={busy || pin.length < 4} className="w-full" style={{ background: "var(--gradient-brand)" }}>
                {busy ? "Memproses…" : "Masuk"}
              </Button>
            </form>
          )}
          {step === 2 && !ortuMode && !dudiMode && (
            <>
              <button type="button" onClick={() => setStep(1)} className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Kembali
              </button>
              <h2 className="text-center font-bold text-sm capitalize">Pilih {role}</h2>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input placeholder={role === "siswa" ? "Cari nama / kelas…" : "Cari nama…"} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-7 text-sm" />
              </div>
              <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
                {loadingList && <p className="text-xs text-center text-muted-foreground py-4">Memuat…</p>}
                {!loadingList && filtered.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-4">Tidak ada data.</p>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.user_id}
                    type="button"
                    onClick={() => { setPicked(c); setStep(3); setPin(""); }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition"
                  >
                    <div className="text-sm font-semibold truncate">{c.nama}</div>
                    {c.kelas && <div className="text-[10px] text-muted-foreground">{c.kelas}</div>}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && picked && (
            <form onSubmit={submitPin} className="space-y-3">
              <button type="button" onClick={() => setStep(2)} className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Ganti nama
              </button>
              <div className="text-center">
                <div className="text-xs text-muted-foreground capitalize">{role}</div>
                <div className="font-bold">{picked.nama}</div>
                {picked.kelas && <div className="text-[11px] text-muted-foreground">{picked.kelas}</div>}
              </div>
              <div>
                <label className="text-xs font-semibold">PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  required
                  className="text-center tracking-[0.5em] text-lg h-12"
                  placeholder="••••"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                  PIN default: <b>1234</b> · ubah di halaman Profil setelah masuk
                </p>
              </div>
              <Button type="submit" disabled={busy || pin.length < 4} className="w-full" style={{ background: "var(--gradient-brand)" }}>
                {busy ? "Memproses…" : "Masuk"}
              </Button>
            </form>
          )}
          {adminExists === false && (
            <button type="button" onClick={() => setShowBootstrap(true)} className="w-full text-xs text-primary font-semibold underline pt-2">
              Belum ada admin — buat akun admin pertama
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleBootstrap} className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-3 border border-border">
          <h2 className="font-extrabold text-center">Buat Admin Pertama</h2>
          <Input placeholder="Nama Lengkap" required value={bForm.nama} onChange={(e) => setBForm({ ...bForm, nama: e.target.value })} />
          <Input placeholder="Username (huruf kecil tanpa spasi)" required value={bForm.username} onChange={(e) => setBForm({ ...bForm, username: e.target.value })} />
          <Input type="password" placeholder="Kata Sandi (min. 6)" required minLength={6} value={bForm.password} onChange={(e) => setBForm({ ...bForm, password: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">PIN default akun admin: <b>1234</b> (dapat diubah).</p>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Memproses…" : "Buat Admin"}</Button>
          <button type="button" onClick={() => setShowBootstrap(false)} className="w-full text-xs text-muted-foreground">Batal</button>
        </form>
      )}
      <footer className="mt-8 text-center text-[11px] text-muted-foreground space-y-1">
        <p>
          <Link to="/panduan" className="text-primary font-semibold hover:underline">Buku Panduan Aplikasi</Link>
        </p>
        <p>Dibuat oleh <span className="font-semibold text-foreground">Agus Rusbandi</span></p>
        <a href="mailto:arusbandi@gmail.com" className="text-primary hover:underline">arusbandi@gmail.com</a>
      </footer>

    </div>
  );
}

function RoleButton({ icon, label, desc, onClick }: { icon: React.ReactNode; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div>
        <div className="font-bold text-sm">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}