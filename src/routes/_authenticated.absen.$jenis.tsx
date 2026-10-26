import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition, reverseGeocode } from "@/lib/geo";
import { composePhoto } from "@/lib/photo-overlay";
import { compressAttendancePhoto } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, RotateCcw, Check, Share2, ArrowLeft, SwitchCamera, Loader2 } from "lucide-react";
import { copyTextSafely, sharePhotoToWhatsApp } from "@/lib/whatsapp";
import { bolehAbsenPulang, labelJamPulang } from "@/lib/jam-pulang";

export const Route = createFileRoute("/_authenticated/absen/$jenis")({
  component: AbsenPage,
});

function AbsenPage() {
  const { jenis } = useParams({ from: "/_authenticated/absen/$jenis" });
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [namaLokasi, setNamaLokasi] = useState<string>("Mencari lokasi…");
  const [gpsReady, setGpsReady] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const jenisLabel = jenis === "masuk" ? "Absen Masuk" : "Absen Pulang";

  // Absen pulang hanya boleh setelah absen masuk hari ini
  useEffect(() => {
    if (jenis !== "pulang" || !user) return;
    if (!bolehAbsenPulang()) {
      toast.error("Belum waktunya Absen Pulang", {
        description: `Absen Pulang hari ini dibuka mulai pukul ${labelJamPulang()}.`,
      });
      navigate({ to: "/beranda" });
      return;
    }
    let cancelled = false;
    (async () => {
      const tanggal = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Makassar",
      }).format(new Date());
      const { data } = await supabase
        .from("attendance")
        .select("id")
        .eq("user_id", user.id)
        .eq("tanggal", tanggal)
        .eq("jenis", "masuk")
        .limit(1);
      if (cancelled) return;
      if (!data || data.length === 0) {
        toast.error("Absen Masuk dulu", {
          description: "Absen Pulang hanya bisa setelah Absen Masuk hari ini.",
        });
        navigate({ to: "/beranda" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jenis, user, navigate]);

  // GPS
  useEffect(() => {
    getCurrentPosition()
      .then(async (p) => {
        setPos({ lat: p.lat, lng: p.lng });
        const name = await reverseGeocode(p.lat, p.lng);
        setNamaLokasi(name);
        setGpsReady(true);
      })
      .catch((e) => {
        toast.warning("GPS tidak tersedia", {
          description: "Foto absen tetap bisa diambil tanpa lokasi.",
        });
        setNamaLokasi("Lokasi tidak tersedia");
        setGpsReady(true);
      });
  }, []);

  // Camera
  useEffect(() => {
    if (savedUrl || previewBlob) return;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("NotSupported");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        const name = e?.name ?? "";
        let msg = "Tidak bisa mengakses kamera.";
        if (name === "NotAllowedError" || /permission/i.test(e?.message ?? "")) {
          msg = "Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera untuk situs ini. Jika dibuka dari aplikasi (FB/IG/WA), tap menu ⋮ → 'Buka di Chrome'.";
        } else if (name === "NotFoundError") {
          msg = "Kamera tidak ditemukan di perangkat ini.";
        } else if (name === "NotReadableError") {
          msg = "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.";
        } else if (e?.message === "NotSupported") {
          msg = "Browser tidak mendukung kamera. Buka halaman ini di Chrome/Safari, bukan di dalam aplikasi (FB/IG/WA).";
        }
        setCameraError(msg);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [savedUrl, previewBlob, facing]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
    setPreviewBlob(blob);
    // stop camera while previewing
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const retake = () => {
    setPreviewBlob(null);
    setFinalBlob(null);
    setFinalUrl(null);
  };

  const onNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreviewBlob(file);
  };

  const usePhoto = async () => {
    if (!previewBlob || !user || !profile) {
      toast.error("Profil belum siap");
      return;
    }
    setBusy(true);
    try {
      // Kecilkan resolusi + kompresi dulu supaya upload ringan di HP.
      const kecil = await compressAttendancePhoto(previewBlob);
      const composed = await composePhoto({
        imageBlob: kecil,
        jenis: jenis as "masuk" | "pulang",
        taken: new Date(),
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        namaLokasi,
        namaSiswa: profile.nama_siswa ?? "",
        kelas: profile.kelas ?? "",
        tempatMagang: profile.tempat_magang ?? "",
      });
      setFinalBlob(composed);
      const localUrl = URL.createObjectURL(composed);
      setFinalUrl(localUrl);

      // Upload (satu file final saja)
      const path = `${user.id}/${Date.now()}-${jenis}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("attendance-photos")
        .upload(path, composed, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("attendance").insert({
        user_id: user.id,
        jenis,
        latitude: pos?.lat ?? null,
        longitude: pos?.lng ?? null,
        nama_lokasi: namaLokasi,
        photo_url: path,
      });
      if (insErr) throw insErr;

      // Tampilkan foto dari memori perangkat — tidak perlu mengunduh ulang.
      setSavedUrl(localUrl);
      toast.success("Absensi tersimpan!");
    } catch (e: any) {
      toast.error("Gagal menyimpan", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  const shareWA = async () => {
    if (!finalBlob) return;
    const caption = [
      `${jenisLabel} - ${new Date().toLocaleString("id-ID")}`,
      `📍 ${namaLokasi}`,
    ].filter(Boolean).join("\n");

    setSharing(true);
    try {
      const result = await sharePhotoToWhatsApp({
        blob: finalBlob,
        filename: `absen-${jenis}-${Date.now()}.jpg`,
        text: caption,
        title: jenisLabel,
        downloadWhenUnsupported: true,
      });
      if (result === "downloaded" || result === "unsupported") {
        await copyTextSafely(caption);
        toast.warning("Foto sudah diunduh", {
          description: "Pilih foto tersebut saat mengirim lewat WhatsApp.",
        });
      } else if (result === "shared") {
        toast.success("Foto siap dikirim", {
          description: "Caption sudah disalin — tempel di kolom pesan WhatsApp.",
        });
      }
    } catch (e: any) {
      toast.error("Gagal menyiapkan foto", { description: e?.message ?? String(e) });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between p-3 bg-black/60">
        <button onClick={() => navigate({ to: "/beranda" })} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-sm">{jenisLabel}</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div className="relative w-full max-w-md" style={{ aspectRatio: "9/16" }}>
          {savedUrl ? (
            <img src={savedUrl} alt="Hasil absensi" className="w-full h-full object-cover" />
          ) : finalUrl ? (
            <img src={finalUrl} alt="Preview final" className="w-full h-full object-cover" />
          ) : previewBlob ? (
            <img src={URL.createObjectURL(previewBlob)} alt="Preview" className="w-full h-full object-cover" />
          ) : (
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
            playsInline
            muted
          />
          )}

          {cameraError && !previewBlob && !savedUrl && (
            <div className="absolute inset-x-3 top-3 bg-destructive/95 text-destructive-foreground rounded-lg p-3 text-xs space-y-2 z-10">
              <p className="font-bold">Kamera tidak bisa diakses</p>
              <p className="opacity-90 leading-snug">{cameraError}</p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" /> Pakai Kamera HP
              </Button>
            </div>
          )}

          {/* live overlay info */}
          {!previewBlob && !savedUrl && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-xs">
              <p className="font-bold">{jenisLabel}</p>
              <p className="opacity-90">
                📍 {pos
                  ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
                  : gpsReady
                    ? "GPS tidak tersedia"
                    : "Mencari GPS…"}
              </p>
              <p className="opacity-80 line-clamp-2">{namaLokasi}</p>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onNativeCameraChange}
      />

      <div className="p-4 bg-black/80 flex items-center justify-center gap-3">
        {savedUrl ? (
          <>
            <Button onClick={shareWA} disabled={sharing} className="flex-1 h-14 gap-2 bg-green-600 hover:bg-green-700">
              <Share2 className="w-5 h-5" /> {sharing ? "Menyiapkan…" : "Bagikan Foto ke WhatsApp"}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/beranda" })} className="h-14 text-black">
              Selesai
            </Button>
          </>
        ) : previewBlob ? (
          <>
            <Button variant="outline" onClick={retake} className="flex-1 h-14 gap-2 text-black" disabled={busy}>
              <RotateCcw className="w-5 h-5" /> Ulangi
            </Button>
            <Button onClick={usePhoto} disabled={busy} className="flex-1 h-14 gap-2 bg-primary">
              <Check className="w-5 h-5" /> {busy ? "Menyimpan…" : "Gunakan"}
            </Button>
          </>
        ) : cameraError ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={!gpsReady}
            className="flex-1 h-14 gap-2 bg-primary"
          >
            <Camera className="w-5 h-5" /> {gpsReady ? "Ambil Foto (Kamera HP)" : "Menunggu GPS…"}
          </Button>
        ) : (
          <>
            <div className="w-12" />
            <button
              onClick={takePhoto}
              disabled={!gpsReady}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center disabled:opacity-40"
              aria-label={gpsReady ? "Ambil foto" : "Menunggu GPS"}
            >
              {gpsReady ? <Camera className="w-10 h-10" /> : <Loader2 className="w-10 h-10 animate-spin" />}
            </button>
            <button
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Ganti kamera"
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}