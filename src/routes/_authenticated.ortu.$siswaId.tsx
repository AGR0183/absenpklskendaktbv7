import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRekapAnak } from "@/lib/ortu.functions";
import { formatTanggal, formatJam, todayISO } from "@/lib/format";
import { hitungKehadiran, hitungAlpa, formatPersen, formatHari } from "@/lib/kehadiran";
import { makeIsLibur, type JadwalKerja } from "@/lib/libur";
import {
  LogIn,
  LogOut,
  FileText,
  HeartPulse,
  MapPin,
  ArrowLeft,
  Download,
  CalendarX,
  UserCircle,
  Phone,
  GraduationCap,
  Building2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportRekapMatriks } from "@/lib/export-rekap-matriks";
import { toast } from "sonner";
import { RekapDetailDialog } from "@/components/rekap-detail-dialog";

export const Route = createFileRoute("/_authenticated/ortu/$siswaId")({
  component: OrtuAnakDetail,
});

type Att = {
  id: string;
  jenis: string;
  tanggal: string;
  waktu: string;
  nama_lokasi: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  photo_signed_url: string | null;
};
type Profile = {
  id: string;
  nama_siswa: string | null;
  kelas: string | null;
  tempat_magang: string | null;
  no_hp_siswa: string | null;
  no_hp_ortu: string | null;
  no_hp_guru: string | null;
  no_hp_dudi: string | null;
};
type Siswa = { nama_lengkap: string | null; nisn: string | null; kelas: string | null; tempat_pkl: string | null } | null;

function OrtuAnakDetail() {
  const { siswaId } = useParams({ from: "/_authenticated/ortu/$siswaId" });
  const fetchRekap = useServerFn(getRekapAnak);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [siswa, setSiswa] = useState<Siswa>(null);
  const [att, setAtt] = useState<Att[]>([]);
  const [jadwal, setJadwal] = useState<JadwalKerja | null>(null);
  const [hariGlobal, setHariGlobal] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailMode, setDetailMode] = useState<"masuk" | "pulang" | "izin" | "sakit" | "alpa" | null>(null);
  const [photoOpen, setPhotoOpen] = useState<Att | null>(null);

  useEffect(() => {
    fetchRekap({ data: { siswaUserId: siswaId } })
      .then((r) => {
        setProfile(r.profile as Profile);
        setSiswa((r.siswa ?? null) as Siswa);
        setAtt(r.attendance as Att[]);
        setJadwal((((r as any).jadwal ?? null) as JadwalKerja | null));
        setHariGlobal((((r as any).hariAktifGlobal ?? [1, 2, 3, 4, 5, 6]) as number[]));
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [siswaId, fetchRekap]);

  const counts = useMemo(
    () =>
      att.reduce<Record<string, number>>((acc, r) => {
        acc[r.jenis] = (acc[r.jenis] ?? 0) + 1;
        return acc;
      }, {}),
    [att],
  );

  const isLibur = useMemo(() => makeIsLibur(jadwal, hariGlobal), [jadwal, hariGlobal]);
  const kehadiran = useMemo(() => hitungKehadiran(att, isLibur), [att, isLibur]);

  const alpa = useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    for (const r of att) {
      if (!r.tanggal) continue;
      if (isLibur(r.tanggal)) continue;
      if (!byDate.has(r.tanggal)) byDate.set(r.tanggal, new Set());
      byDate.get(r.tanggal)!.add(r.jenis);
    }
    const sorted = Array.from(byDate.keys()).sort();
    const awal = sorted[0];
    const today = todayISO();
    if (!awal || awal > today) return { total: 0, items: [] as { tanggal: string; hari: number; keterangan: string }[] };
    return hitungAlpa(byDate, isLibur, awal, today);
  }, [att, isLibur]);

  function handleExport() {
    if (!profile) return;
    try {
      const profiles = new Map();
      profiles.set(profile.id, {
        id: profile.id,
        nama_siswa: siswa?.nama_lengkap ?? profile.nama_siswa,
        kelas: siswa?.kelas ?? profile.kelas,
        tempat_magang: siswa?.tempat_pkl ?? profile.tempat_magang,
      });
      exportRekapMatriks({
        rows: att.map((r) => ({ user_id: profile.id, jenis: r.jenis, tanggal: r.tanggal })),
        profiles,
        from: "",
        to: "",
        isLibur: (_uid, ymd) => isLibur(ymd),
      });
    } catch (e: any) {
      toast.error("Gagal ekspor", { description: e?.message });
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat…</div>;
  if (err || !profile)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <p className="text-sm text-muted-foreground">{err ?? "Data tidak ditemukan."}</p>
        <Link to="/ortu" className="text-primary text-sm underline">Kembali</Link>
      </div>
    );

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <Link
        to="/ortu"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Anak Saya
      </Link>

      <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: "var(--gradient-brand)" }}>
        <p className="text-xs opacity-90 uppercase tracking-wider font-bold">Profil & Rekap Absensi Anak</p>
        <h1 className="text-xl font-extrabold mt-1">{siswa?.nama_lengkap || profile.nama_siswa || "(tanpa nama)"}</h1>
        <p className="text-xs opacity-90">
          {siswa?.kelas || profile.kelas || "-"} • {siswa?.tempat_pkl || profile.tempat_magang || "-"}
        </p>
      </div>

      {/* Profil Lengkap */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <UserCircle className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Profil Lengkap</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Nama Lengkap</span>
            <span className="font-semibold text-right">{siswa?.nama_lengkap || profile.nama_siswa || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">NISN</span>
            <span className="font-semibold">{siswa?.nisn || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kelas</span>
            <span className="font-semibold">{siswa?.kelas || profile.kelas || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Tempat PKL</span>
            <span className="font-semibold text-right">{siswa?.tempat_pkl || profile.tempat_magang || "-"}</span>
          </div>
          {profile.no_hp_siswa && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> No. HP Siswa</span>
              <span className="font-semibold">{profile.no_hp_siswa}</span>
            </div>
          )}
          {profile.no_hp_ortu && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> No. HP Ortu</span>
              <span className="font-semibold">{profile.no_hp_ortu}</span>
            </div>
          )}
          {profile.no_hp_guru && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> No. HP Guru</span>
              <span className="font-semibold">{profile.no_hp_guru}</span>
            </div>
          )}
          {profile.no_hp_dudi && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> No. HP DUDI</span>
              <span className="font-semibold">{profile.no_hp_dudi}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        <Stat label="Masuk" value={counts.masuk ?? 0} onClick={() => setDetailMode("masuk")} />
        <Stat label="Pulang" value={counts.pulang ?? 0} onClick={() => setDetailMode("pulang")} />
        <Stat label="Izin" value={counts.izin ?? 0} onClick={() => setDetailMode("izin")} />
        <Stat label="Sakit" value={counts.sakit ?? 0} onClick={() => setDetailMode("sakit")} />
        <Stat label="Alpa" value={formatHari(alpa.total)} onClick={() => setDetailMode("alpa")} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Persentase Kehadiran</p>
          <p className="text-2xl font-extrabold text-primary">{formatPersen(kehadiran.persen)}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, kehadiran.persen)}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {formatHari(kehadiran.hadir)} dari {kehadiran.totalHari} hari aktif
        </p>
      </div>

      {/* ALPA */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarX className="w-4 h-4 text-destructive" />
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rekap ALPA</p>
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm text-muted-foreground">Total hari ALPA</p>
          <p className="text-2xl font-extrabold text-destructive">{formatHari(alpa.total)}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Dihitung sejak absen pertama sampai hari ini. Tidak absen penuh = 1 hari, hanya masuk/pulang = 0,5 hari.
        </p>
        {alpa.items.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
            {alpa.items.map((it) => (
              <div key={it.tanggal} className="flex items-center justify-between text-xs rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <CalendarX className="w-3.5 h-3.5 text-destructive" />
                  <span>{formatTanggal(it.tanggal)}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-destructive">{formatHari(it.hari)} hari</span>
                  <p className="text-[10px] text-muted-foreground">{it.keterangan}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleExport} variant="outline" className="w-full mb-5">
        <Download className="w-4 h-4 mr-2" /> Ekspor Rekap ke Excel
      </Button>

      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Riwayat Absensi</h2>
      </div>
      {att.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Belum ada absensi.</p>
      ) : (
        <div className="space-y-2">
          {att.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => r.photo_signed_url && setPhotoOpen(r)}
              className="w-full flex gap-3 bg-card rounded-xl p-3 border border-border text-left hover:border-primary transition disabled:opacity-70"
              disabled={!r.photo_signed_url}
            >
              {r.photo_signed_url ? (
                <img
                  src={r.photo_signed_url}
                  alt="Foto"
                  loading="lazy"
                  className="w-16 h-24 object-cover rounded-lg bg-muted"
                />
              ) : (
                <div className="w-16 h-24 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
                  (tanpa foto)
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {jenisIcon(r.jenis)}
                  <span className="text-xs font-bold uppercase">{r.jenis}</span>
                </div>
                <p className="text-sm font-semibold mt-0.5">{formatTanggal(r.waktu)}</p>
                <p className="text-xs text-muted-foreground">{formatJam(r.waktu)}</p>
                {r.nama_lokasi && (
                  <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {r.nama_lokasi}
                  </p>
                )}
                {r.latitude != null && r.longitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[10px] text-primary underline mt-0.5"
                  >
                    Lihat di Google Maps
                  </a>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!photoOpen} onOpenChange={(o) => !o && setPhotoOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {photoOpen?.jenis} — {photoOpen && formatTanggal(photoOpen.waktu)}
            </DialogTitle>
          </DialogHeader>
          {photoOpen?.photo_signed_url && (
            <img src={photoOpen.photo_signed_url} alt="Foto absen" className="w-full rounded-lg" />
          )}
          <div className="text-xs text-muted-foreground">
            {photoOpen && formatJam(photoOpen.waktu)}
            {photoOpen?.nama_lokasi ? ` • ${photoOpen.nama_lokasi}` : ""}
          </div>
        </DialogContent>
      </Dialog>

      <RekapDetailDialog
        open={!!detailMode}
        onOpenChange={(o) => !o && setDetailMode(null)}
        mode={detailMode}
        att={att}
        alpaItems={alpa.items}
      />

      <p className="text-[10px] text-center text-muted-foreground mt-8">SMKN 2 Kotabaru — SIAP PKL</p>
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  const className = "bg-card border border-border rounded-xl p-2 text-center transition-colors" + (onClick ? " cursor-pointer hover:border-primary hover:bg-primary/5" : "");
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </button>
  ) : (
    <div className={className}>
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function jenisIcon(j: string) {
  if (j === "masuk") return <LogIn className="w-3.5 h-3.5 text-success" />;
  if (j === "pulang") return <LogOut className="w-3.5 h-3.5 text-primary" />;
  if (j === "izin") return <FileText className="w-3.5 h-3.5 text-accent-foreground" />;
  return <HeartPulse className="w-3.5 h-3.5 text-destructive" />;
}
