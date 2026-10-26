import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyWaSchedule } from "@/lib/wa-settings.functions";
import { makeIsLibur } from "@/lib/libur";
import { useAuth } from "@/hooks/use-auth";
import { formatTanggal, formatJam } from "@/lib/format";
import { LogIn, LogOut, MapPin, Share2, FileText, HeartPulse, Trash2, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hitungKehadiran, hitungAlpa, formatHari, formatPersen } from "@/lib/kehadiran";
import { AttendancePhoto } from "@/components/attendance-photo";
import { usePhotoUrl, getPhotoSignedUrl } from "@/lib/attendance-photo";
import { buildWhatsAppTextUrl, copyTextSafely, sharePhotoToWhatsApp } from "@/lib/whatsapp";
import { deleteOwnAttendance } from "@/lib/rekap.functions";

export const Route = createFileRoute("/_authenticated/riwayat")({
  component: RiwayatPage,
});

type Row = {
  id: string;
  jenis: "masuk" | "pulang" | "izin" | "sakit";
  tanggal: string;
  waktu: string;
  latitude: number | null;
  longitude: number | null;
  nama_lokasi: string | null;
  photo_url: string | null;
};

function RiwayatPage() {
  const { user, profile } = useAuth();
  const fetchSchedule = useServerFn(getMyWaSchedule);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Row | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sched, setSched] = useState<{
    hari_aktif: number[] | null;
    hari_aktif_global: number[];
    tanggal_libur: string[];
  } | null>(null);
  const [filter, setFilter] = useState<"masuk" | "izin" | "sakit" | "alpa" | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id,jenis,tanggal,waktu,latitude,longitude,nama_lokasi,photo_url")
        .eq("user_id", user.id)
        .order("waktu", { ascending: false });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSchedule({})
      .then((s: any) => setSched(s))
      .catch(() => setSched(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isLibur = useMemo(
    () =>
      makeIsLibur(
        { hari_aktif: sched?.hari_aktif ?? null, tanggal_libur: sched?.tanggal_libur ?? [] },
        sched?.hari_aktif_global ?? [1, 2, 3, 4, 5, 6],
      ),
    [sched],
  );

  const alpaItems = useMemo(() => {
    if (rows.length === 0) return [] as { tanggal: string; hari: number; keterangan: string }[];
    // peta tanggal → kumpulan jenis absen
    const byDate = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!r.tanggal) continue;
      let s = byDate.get(r.tanggal);
      if (!s) byDate.set(r.tanggal, (s = new Set()));
      s.add(r.jenis);
    }
    const sorted = Array.from(byDate.keys()).sort();
    const awal = sorted[0];
    if (!awal) return [];
    const now = new Date();
    const wita = new Date(now.getTime() + 8 * 3600 * 1000);
    const today = wita.toISOString().slice(0, 10);
    const { items } = hitungAlpa(byDate, isLibur, awal, today);
    return items.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [rows, isLibur]);

  const alpaTotal = alpaItems.reduce((s, it) => s + it.hari, 0);

  const visibleRows = useMemo(() => {
    if (!filter || filter === "alpa") return filter === "alpa" ? [] : rows;
    if (filter === "masuk") return rows.filter((r) => r.jenis === "masuk" || r.jenis === "pulang");
    return rows.filter((r) => r.jenis === filter);
  }, [rows, filter]);

  const shareRow = async (r: Row) => {
    const judul =
      r.jenis === "masuk"
        ? "Absen Masuk"
        : r.jenis === "pulang"
        ? "Absen Pulang"
        : r.jenis === "izin"
        ? "Surat Izin"
        : "Surat Sakit";
    const caption = [
      `*${judul}*`,
      `${profile?.nama_siswa ?? ""}${profile?.kelas ? " • " + profile.kelas : ""}`,
      `📅 ${formatTanggal(r.waktu)}`,
      `⏰ ${formatJam(r.waktu)}`,
      r.nama_lokasi ? `📍 ${r.nama_lokasi}` : null,
    ].filter(Boolean).join("\n");
    setSharingId(r.id);
    try {
      const signed = r.photo_url ? await getPhotoSignedUrl(r.photo_url) : null;
      if (!signed) throw new Error("Foto absen tidak tersedia");
      const result = await sharePhotoToWhatsApp({
        url: signed,
        filename: `absen-${r.jenis}-${r.tanggal}.jpg`,
        text: caption,
        title: judul,
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
      toast.error("Gagal menyiapkan WhatsApp", { description: e?.message ?? String(e) });
    } finally {
      setSharingId(null);
    }
  };

  const deleteRow = async (r: Row) => {
    if (!window.confirm("Hapus data absen ini?")) return;
    setDeletingId(r.id);
    try {
      await deleteOwnAttendance({ data: { id: r.id } });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Data absen dihapus");
    } catch (e: any) {
      toast.error("Gagal menghapus", { description: e?.message ?? String(e) });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-extrabold mb-3">Riwayat Absen</h1>
      {!loading && rows.length > 0 && (() => {
        const { hadir, persen } = hitungKehadiran(rows, isLibur);
        const izin = new Set(rows.filter((r) => r.jenis === "izin").map((r) => r.tanggal)).size;
        const sakit = new Set(rows.filter((r) => r.jenis === "sakit").map((r) => r.tanggal)).size;
        return (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <StatCard
              label="Masuk"
              value={formatHari(hadir)}
              sub={formatPersen(persen)}
              color="text-success"
              active={filter === "masuk"}
              onClick={() => setFilter(filter === "masuk" ? null : "masuk")}
            />
            <StatCard
              label="Izin"
              value={izin}
              sub="hari"
              color="text-accent-foreground"
              active={filter === "izin"}
              onClick={() => setFilter(filter === "izin" ? null : "izin")}
            />
            <StatCard
              label="Sakit"
              value={sakit}
              sub="hari"
              color="text-destructive"
              active={filter === "sakit"}
              onClick={() => setFilter(filter === "sakit" ? null : "sakit")}
            />
            <StatCard
              label="Alpa"
              value={formatHari(alpaTotal)}
              sub="hari"
              color="text-destructive"
              active={filter === "alpa"}
              onClick={() => setFilter(filter === "alpa" ? null : "alpa")}
            />
          </div>
        );
      })()}
      {filter && (
        <button
          type="button"
          onClick={() => setFilter(null)}
          className="mb-3 text-xs font-semibold text-primary underline"
        >
          Tampilkan semua riwayat
        </button>
      )}
      {user && (
        <a
          href={buildWhatsAppTextUrl(
            `Rekap absensi PKL saya (${profile?.nama_siswa ?? ""}):\n${typeof window !== "undefined" ? window.location.origin : ""}/rekap/${user.id}`,
          )}
          target="_blank"
          rel="noreferrer"
          className="block mb-4"
        >
          <Button type="button" className="w-full h-11 gap-2 bg-green-600 hover:bg-green-700 text-xs">
            <Share2 className="w-3.5 h-3.5" /> Kirim Link Rekap ke WhatsApp Guru Pembimbing
          </Button>
        </a>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : filter === "alpa" ? (
        alpaItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada hari alpa. 🎉</p>
        ) : (
          <div className="space-y-2">
            {alpaItems.map((it) => (
              <div
                key={it.tanggal}
                className="flex items-center gap-2 bg-card rounded-xl p-3 border border-border shadow-[var(--shadow-card)]"
              >
                <CalendarX className="w-4 h-4 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{formatTanggal(it.tanggal)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">
                    Alpa {formatHari(it.hari)} hari
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground text-right max-w-[40%]">{it.keterangan}</p>
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada absensi.</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada data untuk jenis ini.</p>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((r) => {
            return (
              <div
                key={r.id}
                className="w-full flex gap-3 bg-card rounded-xl p-3 border border-border shadow-[var(--shadow-card)] items-center"
              >
                <button onClick={() => setOpen(r)} className="flex-1 flex gap-3 text-left min-w-0">
                  {r.photo_url ? (
                    <AttendancePhoto
                      photoUrl={r.photo_url}
                      alt="Foto absen"
                      className="w-16 h-24 object-cover rounded-lg bg-muted shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-24 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-1 shrink-0">
                      foto dihapus
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {r.jenis === "masuk" && <LogIn className="w-3.5 h-3.5 text-success" />}
                      {r.jenis === "pulang" && <LogOut className="w-3.5 h-3.5 text-primary" />}
                      {r.jenis === "izin" && <FileText className="w-3.5 h-3.5 text-accent-foreground" />}
                      {r.jenis === "sakit" && <HeartPulse className="w-3.5 h-3.5 text-destructive" />}
                      <span className="text-xs font-bold uppercase">{r.jenis}</span>
                    </div>
                    <p className="text-sm font-semibold mt-0.5">{formatTanggal(r.waktu)}</p>
                    <p className="text-xs text-muted-foreground">{formatJam(r.waktu)}</p>
                    {r.nama_lokasi && (
                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {r.nama_lokasi}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shareRow(r);
                  }}
                  disabled={sharingId === r.id}
                  className="shrink-0 w-10 h-10 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center text-white disabled:opacity-60"
                  aria-label="Bagikan foto ke WhatsApp"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRow(r);
                  }}
                  disabled={deletingId === r.id}
                  className="shrink-0 w-10 h-10 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center text-destructive-foreground disabled:opacity-60"
                  aria-label="Hapus data absen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <FullPhotoModal photoUrl={open.photo_url} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-card border rounded-xl p-3 text-center shadow-[var(--shadow-card)] transition ${
        active ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <p className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</p>
      <p className={`text-lg font-extrabold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </button>
  );
}

function FullPhotoModal({ photoUrl, onClose }: { photoUrl: string | null; onClose: () => void }) {
  const signed = usePhotoUrl(photoUrl);
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 flex items-center justify-center p-4">
        {photoUrl ? (
          signed ? (
            <img src={signed} alt="Foto absensi penuh" className="max-w-full max-h-full rounded-xl" />
          ) : (
            <p className="text-white text-sm">Memuat…</p>
          )
        ) : (
          <p className="text-white text-sm">Foto sudah dihapus (lebih dari 30 hari).</p>
        )}
      </div>
      <button onClick={onClose} className="text-white text-center py-4 font-semibold">
        Tutup
      </button>
    </div>
  );
}