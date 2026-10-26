import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getDailyQuote } from "@/lib/quotes";
import { formatTanggal, todayISO } from "@/lib/format";
import { bolehAbsenPulang, labelJamPulang } from "@/lib/jam-pulang";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, Sparkles, CheckCircle2, FileText, HeartPulse, Share2, Images, Camera } from "lucide-react";
import { toast } from "sonner";
import { copyTextSafely, sharePhotoToWhatsApp } from "@/lib/whatsapp";
import { PengaturanKerjaCard } from "@/components/pengaturan-kerja-card";
import { PengaturanLiburCard } from "@/components/pengaturan-libur-card";
import { NotifikasiHpCard } from "@/components/notifikasi-hp-card";

import logo from "@/assets/logo-smkn2.png";

export const Route = createFileRoute("/_authenticated/beranda")({
  component: BerandaPage,
});

function BerandaPage() {
  const { profile, user } = useAuth();
  const quote = getDailyQuote();
  const [today, setToday] = useState<{ masuk: boolean; pulang: boolean }>({ masuk: false, pulang: false });
  const izinRef = useRef<HTMLInputElement>(null);
  const sakitRef = useRef<HTMLInputElement>(null);
  const izinGaleriRef = useRef<HTMLInputElement>(null);
  const sakitGaleriRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<null | "izin" | "sakit">(null);
  const [surat, setSurat] = useState<{ file: File; jenis: "izin" | "sakit" } | null>(null);
  const [sharingSurat, setSharingSurat] = useState(false);
  const [suratPreview, setSuratPreview] = useState<string | null>(null);
  const [pulangDibuka, setPulangDibuka] = useState(() => bolehAbsenPulang());

  useEffect(() => {
    const t = setInterval(() => setPulangDibuka(bolehAbsenPulang()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!surat) {
      setSuratPreview(null);
      return;
    }
    const url = URL.createObjectURL(surat.file);
    setSuratPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [surat]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("jenis")
        .eq("user_id", user.id)
        .eq("tanggal", todayISO());
      const set = new Set((data ?? []).map((d) => d.jenis));
      setToday({ masuk: set.has("masuk"), pulang: set.has("pulang") });
    })();
  }, [user]);

  async function uploadSurat(file: File, jenis: "izin" | "sakit") {
    if (!user) return;
    setUploading(jenis);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}-${jenis}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attendance-photos")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("attendance").insert({
        user_id: user.id,
        jenis,
        latitude: null as any,
        longitude: null as any,
        nama_lokasi: null,
        photo_url: path,
      });
      if (insErr) throw insErr;
      setSurat({ file, jenis });
      toast.success(`Surat ${jenis} terkirim!`);
    } catch (e: any) {
      toast.error("Gagal mengirim", { description: e?.message ?? String(e) });
    } finally {
      setUploading(null);
    }
  }

  async function shareSurat() {
    if (!surat) return;
    const label = surat.jenis === "izin" ? "Surat Izin" : "Surat Sakit";
    const caption = [
      `${label} - ${profile?.nama_siswa ?? ""}`,
      `${profile?.kelas ?? ""} • ${profile?.tempat_magang ?? ""}`,
      formatTanggal(new Date()),
    ].filter(Boolean).join("\n");
    setSharingSurat(true);
    try {
      const result = await sharePhotoToWhatsApp({
        blob: surat.file,
        filename: `surat-${surat.jenis}-${Date.now()}.jpg`,
        text: caption,
        title: label,
        downloadWhenUnsupported: true,
      });
      if (result === "downloaded" || result === "unsupported") {
        await copyTextSafely(caption);
        toast.warning("Foto surat sudah diunduh", {
          description: "Pilih foto tersebut saat mengirim lewat WhatsApp.",
        });
      } else if (result === "shared") {
        toast.success("Foto surat siap dikirim", {
          description: "Caption sudah disalin — tempel di kolom pesan WhatsApp.",
        });
      }
    } catch (e: any) {
      toast.error("Gagal menyiapkan foto", { description: e?.message ?? String(e) });
    } finally {
      setSharingSurat(false);
    }
  }

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <img src={logo} alt="Logo" className="w-12 h-12 object-contain" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Selamat datang,</p>
          <h1 className="font-bold text-foreground truncate">{profile?.nama_siswa || "Siswa"}</h1>
          <p className="text-xs text-muted-foreground truncate">{profile?.kelas} • {profile?.tempat_magang}</p>
        </div>
      </div>

      {/* Quote of the day */}
      <div className="rounded-2xl p-5 mb-5 text-white shadow-[var(--shadow-button)] relative overflow-hidden"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="absolute -top-4 -right-4 opacity-20">
          <Sparkles className="w-24 h-24" />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Kata-kata Hari Ini!</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              {quote.category}
            </span>
          </div>
          <p className="font-semibold text-base leading-snug">"{quote.text}"</p>
          <p className="text-[10px] opacity-80 mt-2">{formatTanggal(new Date())}</p>
        </div>
      </div>

      {/* Status today */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatusCard label="Absen Masuk" done={today.masuk} color="success" />
        <StatusCard label="Absen Pulang" done={today.pulang} color="primary" />
      </div>

      {/* CTA buttons */}
      <div className="space-y-3 mb-6">
        <AbsenButton jenis="masuk" disabled={today.masuk} />
        <AbsenButton
          jenis="pulang"
          disabled={today.pulang || !today.masuk || !pulangDibuka}
          done={today.pulang}
          note={
            !today.pulang && today.masuk && !pulangDibuka
              ? `Absen Pulang dibuka mulai ${labelJamPulang()}`
              : undefined
          }
        />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <input
            ref={izinRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadSurat(f, "izin");
              e.target.value = "";
            }}
          />
          <input
            ref={sakitRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadSurat(f, "sakit");
              e.target.value = "";
            }}
          />
          <input
            ref={izinGaleriRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadSurat(f, "izin");
              e.target.value = "";
            }}
          />
          <input
            ref={sakitGaleriRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadSurat(f, "sakit");
              e.target.value = "";
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={uploading !== null}
                className="h-14 gap-2 border-accent text-accent-foreground"
              >
                <FileText className="w-5 h-5" />
                {uploading === "izin" ? "Mengirim…" : "Foto Surat Izin"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={() => izinRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" />
                Ambil Foto
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => izinGaleriRef.current?.click()}>
                <Images className="w-4 h-4 mr-2" />
                Pilih dari Galeri
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={uploading !== null}
                className="h-14 gap-2 border-destructive/40 text-destructive"
              >
                <HeartPulse className="w-5 h-5" />
                {uploading === "sakit" ? "Mengirim…" : "Foto Surat Sakit"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => sakitRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" />
                Ambil Foto
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sakitGaleriRef.current?.click()}>
                <Images className="w-4 h-4 mr-2" />
                Pilih dari Galeri
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Catatan */}
      {surat && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
          <p className="text-xs font-bold">
            Surat {surat.jenis === "izin" ? "Izin" : "Sakit"} berhasil difoto
          </p>
          {suratPreview && (
            <a href={suratPreview} target="_blank" rel="noreferrer" className="block">
              <img
                src={suratPreview}
                alt={`Pratinjau surat ${surat.jenis}`}
                className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted"
              />
            </a>
          )}
          <Button
            type="button"
            onClick={shareSurat}
            disabled={sharingSurat}
            className="w-full h-12 gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Share2 className="w-5 h-5" />
            {sharingSurat ? "Menyiapkan…" : "Kirim ke WhatsApp"}
          </Button>
        </div>
      )}

      <div className="rounded-xl bg-accent/30 border border-accent p-4 text-xs text-accent-foreground">
        <p className="font-bold mb-1">📝 Catatan</p>
        <p>Jika Sakit atau Izin, maka silahkan foto Surat Keterangan Sakit atau Izin dari Orang Tua/Wali.</p>
      </div>

      <div className="mt-4 space-y-4">
        <NotifikasiHpCard />

        <PengaturanKerjaCard />

        <PengaturanLiburCard />
      </div>

    </div>
  );
}

function StatusCard({ label, done, color }: { label: string; done: boolean; color: "success" | "primary" }) {
  return (
    <div className={`rounded-xl p-3 border ${done ? `bg-${color}/10 border-${color}/40` : "bg-card border-border"}`}>
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className={`w-5 h-5 text-${color}`} />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hari ini</p>
          <p className="text-sm font-bold">{label}</p>
          <p className={`text-[10px] ${done ? `text-${color} font-semibold` : "text-muted-foreground"}`}>
            {done ? "Selesai" : "Belum"}
          </p>
        </div>
      </div>
    </div>
  );
}

function AbsenButton({ jenis, disabled, done, note }: { jenis: "masuk" | "pulang"; disabled: boolean; done?: boolean; note?: string }) {
  const isMasuk = jenis === "masuk";
  const isDone = done ?? disabled;
  return (
    <div>
    <Link
      to="/absen/$jenis"
      params={{ jenis }}
      disabled={disabled}
      className={`block ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <Button
        type="button"
        disabled={disabled}
        className="w-full h-16 text-base font-bold gap-3 shadow-[var(--shadow-button)]"
        style={{
          background: isMasuk
            ? "linear-gradient(135deg, oklch(0.55 0.16 145), oklch(0.65 0.18 155))"
            : "var(--gradient-warm)",
        }}
      >
        {isMasuk ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
        {isDone
          ? `Sudah Absen ${isMasuk ? "Masuk" : "Pulang"}`
          : `Absen ${isMasuk ? "Masuk" : "Pulang"}`}
      </Button>
    </Link>
      {note && <p className="text-[11px] text-muted-foreground mt-1.5 text-center">{note}</p>}
    </div>
  );
}