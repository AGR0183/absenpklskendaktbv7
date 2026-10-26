import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-smkn2.png";

export const Route = createFileRoute("/_authenticated/setup-profil")({
  component: SetupProfilPage,
});

function SetupProfilPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refresh } = useAuth();
  const [form, setForm] = useState({
    nama_siswa: "",
    kelas: "",
    tempat_magang: "",
    no_hp_siswa: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      setForm({
        nama_siswa: profile.nama_siswa ?? "",
        kelas: profile.kelas ?? "",
        tempat_magang: profile.tempat_magang ?? "",
        no_hp_siswa: p.no_hp_siswa ?? "",
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nama_siswa: form.nama_siswa.trim(),
        kelas: form.kelas.trim(),
        tempat_magang: form.tempat_magang.trim(),
        no_hp_siswa: form.no_hp_siswa.trim() || null,
      } as any)
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Gagal menyimpan", { description: error.message });
      return;
    }
    toast.success("Profil tersimpan");
    await refresh();
    navigate({ to: "/beranda" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-8" style={{ background: "var(--gradient-soft)" }}>
      <div className="flex flex-col items-center gap-2 mb-6 mt-2">
        <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
        <h1 className="text-base font-extrabold">Lengkapi Data Siswa</h1>
        <p className="text-xs text-muted-foreground text-center">Data ini akan tertera di setiap absensi Anda.</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-4 border border-border">
        <div className="space-y-1.5">
          <Label htmlFor="nama">Nama Siswa</Label>
          <Input id="nama" required maxLength={100} value={form.nama_siswa} onChange={(e) => setForm((f) => ({ ...f, nama_siswa: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kelas">Kelas</Label>
          <Input id="kelas" required maxLength={50} value={form.kelas} onChange={(e) => setForm((f) => ({ ...f, kelas: e.target.value }))} placeholder="XI TKR 1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tempat">Nama Tempat Magang</Label>
          <Input id="tempat" required maxLength={150} value={form.tempat_magang} onChange={(e) => setForm((f) => ({ ...f, tempat_magang: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hp_siswa">No. HP Siswa</Label>
          <Input id="hp_siswa" inputMode="tel" maxLength={20} placeholder="08xxxxxxxxxx" value={form.no_hp_siswa} onChange={(e) => setForm((f) => ({ ...f, no_hp_siswa: e.target.value }))} />
        </div>
        <p className="text-[11px] text-muted-foreground italic">No. HP Orang Tua, Guru Pembimbing, dan Pembimbing DUDI hanya dapat diisi/diubah oleh admin.</p>
        <Button type="submit" disabled={busy} className="w-full" style={{ background: "var(--gradient-brand)" }}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </form>
    </div>
  );
}