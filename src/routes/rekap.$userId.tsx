import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRekap } from "@/lib/rekap.functions";
import { deleteAttendancePhoto, deleteAttendance } from "@/lib/rekap.functions";
import { formatTanggal, formatJam, todayISO } from "@/lib/format";
import { hitungKehadiran, hitungAlpa, formatPersen, formatHari } from "@/lib/kehadiran";
import { SertifikatButton } from "@/components/sertifikat-button";
import { makeIsLibur, type JadwalKerja } from "@/lib/libur";
import { useAuth } from "@/hooks/use-auth";
import { LogIn, LogOut, FileText, HeartPulse, MapPin, ArrowLeft, Pencil, MessageCircle, Trash2, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateSiswaFull } from "@/lib/siswa.functions";
import { toast } from "sonner";
import { AttendancePhoto } from "@/components/attendance-photo";
import { RekapDetailDialog } from "@/components/rekap-detail-dialog";

export const Route = createFileRoute("/rekap/$userId")({
  component: RekapPublicPage,
  head: () => ({
    meta: [
      { title: "Rekap Absensi SIAP PKL" },
      { name: "description", content: "Rekap absensi siswa PKL SMKN 2 Kotabaru melalui SIAP PKL." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Att = {
  id: string;
  jenis: string;
  tanggal: string;
  waktu: string;
  nama_lokasi: string | null;
  photo_url: string | null;
};
type Profile = { id: string; nama_siswa: string | null; kelas: string | null; tempat_magang: string | null; no_hp_siswa: string | null; no_hp_ortu: string | null; no_hp_guru: string | null; no_hp_dudi: string | null; pin_ortu?: string | null };
type Siswa = { pin: string | null; nama_lengkap: string | null; nisn: string | null; kelas: string | null; tempat_pkl: string | null; user_id: string | null };


function RekapPublicPage() {
  const { userId } = useParams({ from: "/rekap/$userId" });
  const fetchRekap = useServerFn(getRekap);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [siswa, setSiswa] = useState<Siswa | null>(null);
  const [att, setAtt] = useState<Att[]>([]);
  const [jadwal, setJadwal] = useState<JadwalKerja | null>(null);
  const [hariGlobal, setHariGlobal] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailMode, setDetailMode] = useState<"masuk" | "pulang" | "izin" | "sakit" | "alpa" | null>(null);
  const { user, isStaff } = useAuth();
  const { isAdmin } = useAuth();
  const removePhoto = useServerFn(deleteAttendancePhoto);
  const removeRow = useServerFn(deleteAttendance);

  async function handleDeletePhoto(id: string) {
    if (!confirm("Hapus foto absen ini? Data jam absen tetap disimpan.")) return;
    try {
      await removePhoto({ data: { id } });
      setAtt((rows) => rows.map((r) => (r.id === id ? { ...r, photo_url: null } : r)));
      toast.success("Foto absen dihapus");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menghapus foto");
    }
  }

  async function handleDeleteRow(id: string) {
    if (!confirm("Hapus seluruh data absen ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      await removeRow({ data: { id } });
      setAtt((rows) => rows.filter((r) => r.id !== id));
      toast.success("Data absen dihapus");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menghapus data");
    }
  }
  const [editOpen, setEditOpen] = useState(false);
  const saveSiswa = useServerFn(updateSiswaFull);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pin: "", nama_lengkap: "", nisn: "", kelas: "", tempat_pkl: "",
    no_hp_siswa: "", no_hp_ortu: "", no_hp_guru: "", no_hp_dudi: "", pin_ortu: "",
  });

  function openEdit() {
    setForm({
      pin: siswa?.pin || "",
      nama_lengkap: siswa?.nama_lengkap || profile?.nama_siswa || "",
      nisn: siswa?.nisn || "",
      kelas: siswa?.kelas || profile?.kelas || "",
      tempat_pkl: siswa?.tempat_pkl || profile?.tempat_magang || "",
      no_hp_siswa: profile?.no_hp_siswa || "",
      no_hp_ortu: profile?.no_hp_ortu || "",
      no_hp_guru: profile?.no_hp_guru || "",
      no_hp_dudi: profile?.no_hp_dudi || "",
      pin_ortu: profile?.pin_ortu || "1122",
    });
    setEditOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSiswa({ data: { user_id: userId, ...form } });
      setProfile((p) => p && { ...p,
        nama_siswa: form.nama_lengkap,
        kelas: form.kelas,
        tempat_magang: form.tempat_pkl,
        no_hp_siswa: form.no_hp_siswa,
        no_hp_ortu: form.no_hp_ortu,
        no_hp_guru: form.no_hp_guru,
        no_hp_dudi: form.no_hp_dudi,
        pin_ortu: form.pin_ortu,
      });
      setSiswa((s) => ({
        pin: form.pin,
        nama_lengkap: form.nama_lengkap,
        nisn: form.nisn,
        kelas: form.kelas,
        tempat_pkl: form.tempat_pkl,
        user_id: s?.user_id ?? userId,
      }));
      toast.success("Profil siswa diperbarui");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchRekap({ data: { userId } })
      .then((r) => {
        setProfile(r.profile as Profile);
        setSiswa((r.siswa ?? null) as Siswa | null);
        setAtt(r.attendance as Att[]);
        setJadwal((((r as any).jadwal ?? null) as JadwalKerja | null));
        setHariGlobal((((r as any).hariAktifGlobal ?? [1, 2, 3, 4, 5, 6]) as number[]));
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [userId, fetchRekap]);

  const counts = att.reduce<Record<string, number>>((acc, r) => {
    acc[r.jenis] = (acc[r.jenis] ?? 0) + 1;
    return acc;
  }, {});
  const isLibur = makeIsLibur(jadwal, hariGlobal);
  const kehadiran = hitungKehadiran(att, isLibur);

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
    if (!awal) return { total: 0, items: [] as { tanggal: string; hari: number; keterangan: string }[] };
    return hitungAlpa(byDate, isLibur, awal, todayISO());
  }, [att, isLibur]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat…</div>;
  if (err || !profile)
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">{err ?? "Data tidak ditemukan."}</p>
      </div>
    );

  const backTo = isStaff ? "/admin" : user ? "/beranda" : "/";

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Beranda
      </Link>

      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Profil Siswa</h2>
          {isStaff && (
            <Button size="sm" variant="outline" onClick={openEdit} className="h-7 px-2 text-xs">
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nama Lengkap</span>
            <span className="font-semibold">{siswa?.nama_lengkap || profile.nama_siswa || "-"}</span>
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
            <span className="text-muted-foreground">Tempat PKL</span>
            <span className="font-semibold">{siswa?.tempat_pkl || profile.tempat_magang || "-"}</span>
          </div>
          {profile.no_hp_siswa && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. HP Siswa</span>
              <span className="font-semibold">{profile.no_hp_siswa}</span>
            </div>
          )}
          {profile.no_hp_ortu && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. HP Ortu</span>
              <span className="font-semibold">{profile.no_hp_ortu}</span>
            </div>
          )}
          {profile.no_hp_guru && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. HP Guru</span>
              <span className="font-semibold">{profile.no_hp_guru}</span>
            </div>
          )}
          {profile.no_hp_dudi && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. HP DUDI</span>
              <span className="font-semibold">{profile.no_hp_dudi}</span>
            </div>
          )}
        </div>
        {isStaff && (
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.no_hp_siswa && (
              <a
                href={waLink(profile.no_hp_siswa, `Halo ${siswa?.nama_lengkap || profile.nama_siswa || ""}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 rounded-md px-2 py-1 border border-[#25D366]/30"
              >
                <MessageCircle className="w-3 h-3" /> WA Siswa
              </a>
            )}
            {profile.no_hp_ortu && (
              <a
                href={waLink(profile.no_hp_ortu, `Yth. Orang Tua/Wali ${siswa?.nama_lengkap || profile.nama_siswa || ""}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 rounded-md px-2 py-1 border border-[#25D366]/30"
              >
                <MessageCircle className="w-3 h-3" /> WA Ortu
              </a>
            )}
            {profile.no_hp_guru && (
              <a
                href={waLink(profile.no_hp_guru, `Yth. Bapak/Ibu Guru`)} 
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 rounded-md px-2 py-1 border border-[#25D366]/30"
              >
                <MessageCircle className="w-3 h-3" /> WA Guru
              </a>
            )}
            {profile.no_hp_dudi && (
              <a
                href={waLink(profile.no_hp_dudi, `Yth. Pembimbing DUDI`)} 
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 rounded-md px-2 py-1 border border-[#25D366]/30"
              >
                <MessageCircle className="w-3 h-3" /> WA DUDI
              </a>
            )}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profil Siswa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {([
              ["pin", "PIN"],
              ["nama_lengkap", "Nama Lengkap"],
              ["nisn", "NISN"],
              ["kelas", "Kelas"],
              ["tempat_pkl", "Tempat PKL"],
              ["no_hp_siswa", "No. HP Siswa"],
              ["no_hp_ortu", "No. HP Orang Tua"],
              ["no_hp_guru", "No. HP Guru"],
              ["no_hp_dudi", "No. HP DUDI"],
              ...(isAdmin ? [["pin_ortu", "PIN Orang Tua"]] : []),
            ] as [string, string][]).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`f-${key}`} className="text-xs">{label}</Label>
                <Input
                  id={`f-${key}`}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: "var(--gradient-brand)" }}>
        <p className="text-xs opacity-90 uppercase tracking-wider font-bold">Rekap Absensi PKL</p>
        <h1 className="text-xl font-extrabold mt-1">{siswa?.nama_lengkap || profile.nama_siswa || "(tanpa nama)"}</h1>
        <p className="text-xs opacity-90">{siswa?.kelas || profile.kelas} • {siswa?.tempat_pkl || profile.tempat_magang}</p>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-5">
        <Stat label="Masuk" value={counts.masuk ?? 0} onClick={() => setDetailMode("masuk")} />
        <Stat label="Pulang" value={counts.pulang ?? 0} onClick={() => setDetailMode("pulang")} />
        <Stat label="Izin" value={counts.izin ?? 0} onClick={() => setDetailMode("izin")} />
        <Stat label="Sakit" value={counts.sakit ?? 0} onClick={() => setDetailMode("sakit")} />
        <Stat label="Alpa" value={formatHari(alpa.total)} onClick={() => setDetailMode("alpa")} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Persentase Kehadiran</p>
          <p className="text-2xl font-extrabold text-primary">{formatPersen(kehadiran.persen)}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, kehadiran.persen)}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {formatHari(kehadiran.hadir)} dari {kehadiran.totalHari} hari aktif
          {" "}<span className="opacity-70">(masuk+pulang = 1 hari, hanya masuk = 0,5 hari)</span>
        </p>
        <SertifikatButton
          className="mt-3"
          nama={siswa?.nama_lengkap || profile.nama_siswa || "Siswa"}
          kelas={siswa?.kelas || profile.kelas || "-"}
          tempat={(siswa as any)?.tempat_magang || (profile as any)?.tempat_magang || "-"}
          persen={kehadiran.persen}
        />
      </div>

      {att.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada absensi.</p>
      ) : (
        <div className="space-y-3">
          {att.map((r) => (
            <RowItem
              key={r.id}
              r={r}
              libur={isLibur(r.tanggal)}
              canDeletePhoto={isStaff}
              canDeleteRow={isAdmin}
              onDeletePhoto={() => handleDeletePhoto(r.id)}
              onDeleteRow={() => handleDeleteRow(r.id)}
            />
          ))}
        </div>
      )}

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

function waLink(phone: string, text?: string): string {
  let s = phone.replace(/[^0-9]/g, "");
  if (s.startsWith("62")) {
    // ok
  } else if (s.startsWith("0")) {
    s = "62" + s.slice(1);
  } else if (s.startsWith("8")) {
    s = "62" + s;
  }
  const url = new URL(`https://wa.me/${s}`);
  if (text) url.searchParams.set("text", text);
  return url.toString();
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

function RowItem({
  r,
  libur,
  canDeletePhoto,
  canDeleteRow,
  onDeletePhoto,
  onDeleteRow,
}: {
  r: Att;
  libur?: boolean;
  canDeletePhoto: boolean;
  canDeleteRow: boolean;
  onDeletePhoto: () => void;
  onDeleteRow: () => void;
}) {
  return (
    <div className="flex gap-3 bg-card rounded-xl p-3 border border-border">
      {r.photo_url ? (
        <AttendancePhoto
          photoUrl={r.photo_url}
          alt="Foto"
          asLink
          className="w-16 h-24 object-cover rounded-lg bg-muted"
        />
      ) : (
        <div className="w-16 h-24 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
          (foto sudah dihapus)
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {jenisIcon(r.jenis)}
          <span className="text-xs font-bold uppercase">{r.jenis}</span>
          {libur && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Libur
            </span>
          )}
        </div>
        <p className="text-sm font-semibold mt-0.5">{formatTanggal(r.waktu)}</p>
        <p className="text-xs text-muted-foreground">{formatJam(r.waktu)}</p>
        {r.nama_lokasi && (
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {r.nama_lokasi}
          </p>
        )}
        {(canDeletePhoto || canDeleteRow) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {canDeletePhoto && r.photo_url && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={onDeletePhoto}
              >
                <ImageOff className="w-3 h-3 mr-1" /> Hapus Foto
              </Button>
            )}
            {canDeleteRow && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-[11px]"
                onClick={onDeleteRow}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Hapus Absen
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}