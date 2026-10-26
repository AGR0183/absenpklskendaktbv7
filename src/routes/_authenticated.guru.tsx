import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { formatTanggal, formatJam } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Share2, Trash2, Globe2, Star } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteSiswa, listSiswa } from "@/lib/siswa.functions";
import { syncFavoritByGuruPhone } from "@/lib/favorit.functions";
import { toast } from "sonner";
import { AttendancePhoto } from "@/components/attendance-photo";
import { RekapRingkasanCard } from "@/components/rekap-ringkasan-card";
import { NotifikasiHpCard } from "@/components/notifikasi-hp-card";
import { buildWhatsAppTextUrl } from "@/lib/whatsapp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_authenticated/guru")({
  component: GuruPage,
});

type Student = { id: string; nama_siswa: string | null; kelas: string | null; tempat_magang: string | null };
type Att = { id: string; jenis: string; waktu: string; nama_lokasi: string | null; photo_url: string };

function StudentRow({
  s,
  isFav,
  onOpen,
  onToggleFav,
  onDelete,
}: {
  s: Student;
  isFav: boolean;
  onOpen: () => void;
  onToggleFav: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-card rounded-xl p-3 border border-border">
      <button
        type="button"
        onClick={onToggleFav}
        aria-label={isFav ? "Hapus dari favorit" : "Tandai favorit"}
        className="shrink-0 p-1"
      >
        <Star
          className={`w-5 h-5 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <p className="font-bold truncate">{s.nama_siswa || "(tanpa nama)"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {s.kelas} • {s.tempat_magang}
        </p>
      </button>
      <Button
        size="sm"
        variant="destructive"
        onClick={onDelete}
        className="h-8 px-2 gap-1 text-[10px]"
      >
        <Trash2 className="w-3 h-3" /> Hapus
      </Button>
    </div>
  );
}

function GuruPage() {
  const { isStaff, loading, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [att, setAtt] = useState<Att[]>([]);
  const callDelete = useServerFn(deleteSiswa);
  const callList = useServerFn(listSiswa);
  const syncFavorit = useServerFn(syncFavoritByGuruPhone);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        await syncFavorit({});
      } catch {
        /* abaikan kegagalan sinkronisasi otomatis */
      }
      const { data } = await supabase
        .from("guru_favorit_siswa")
        .select("siswa_id")
        .eq("guru_id", user.id);
      setFavorites((data ?? []).map((r: any) => r.siswa_id as string));
    };
    load();
  }, [user?.id]);

  const toggleFavorite = async (id: string) => {
    if (!user?.id) return;
    const isFav = favorites.includes(id);
    // optimistic
    setFavorites((prev) =>
      isFav ? prev.filter((x) => x !== id) : [...prev, id],
    );
    try {
      if (isFav) {
        const { error } = await supabase
          .from("guru_favorit_siswa")
          .delete()
          .eq("guru_id", user.id)
          .eq("siswa_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("guru_favorit_siswa")
          .insert({ guru_id: user.id, siswa_id: id });
        if (error) throw error;
      }
    } catch (e: any) {
      // rollback
      setFavorites((prev) =>
        isFav ? [...prev, id] : prev.filter((x) => x !== id),
      );
      toast.error("Gagal menyimpan favorit", { description: e?.message });
    }
  };


  const loadStudents = () => {
    callList({})
      .then((r: any) => {
        const mapped: Student[] = (r?.rows ?? [])
          .filter((s: any) => s.user_id)
          .map((s: any) => ({
            id: s.user_id as string,
            nama_siswa: s.nama_lengkap ?? null,
            kelas: s.kelas ?? null,
            tempat_magang: s.tempat_pkl ?? null,
          }))
          .sort((a: Student, b: Student) =>
            (a.nama_siswa ?? "").localeCompare(b.nama_siswa ?? ""),
          );
        setStudents(mapped);
      })
      .catch(() => setStudents([]));
  };

  const handleDelete = (s: Student) => {
    setDeleteTarget(s);
    setOpenDeleteDialog(true);
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await callDelete({ data: { user_id: deleteTarget.id } });
      toast.success("Siswa dihapus");
      if (selected?.id === deleteTarget.id) setSelected(null);
      loadStudents();
    } catch (e: any) {
      toast.error("Gagal menghapus", { description: e?.message });
    } finally {
      setOpenDeleteDialog(false);
      setDeleteTarget(null);
    }
  };


  useEffect(() => {
    if (!loading && !isStaff) navigate({ to: "/beranda" });
  }, [loading, isStaff, navigate]);

  useEffect(() => {
    if (!isStaff) return;
    loadStudents();
  }, [isStaff]);

  useEffect(() => {
    if (!selected) return;
    supabase
      .from("attendance")
      .select("id,jenis,waktu,nama_lokasi,photo_url")
      .eq("user_id", selected.id)
      .order("waktu", { ascending: false })
      .then(({ data }) => setAtt((data as Att[]) ?? []));
  }, [selected]);

  const filtered = students.filter((s) => {
    const t = q.toLowerCase();
    return (
      (s.nama_siswa ?? "").toLowerCase().includes(t) ||
      (s.kelas ?? "").toLowerCase().includes(t) ||
      (s.tempat_magang ?? "").toLowerCase().includes(t)
    );
  });

  const favSet = new Set(favorites);
  const favStudents = students.filter((s) => favSet.has(s.id));
  const filteredFav = filtered.filter((s) => favSet.has(s.id));
  const filteredOther = filtered.filter((s) => !favSet.has(s.id));

  if (selected) {
    const rekapUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/rekap/${selected.id}`;
    const shareText = `Rekap absensi PKL atas nama ${selected.nama_siswa ?? ""} (${selected.kelas ?? ""}):\n${rekapUrl}`;
    const waHref = buildWhatsAppTextUrl(shareText);
    return (
      <div className="px-5 py-6 max-w-md mx-auto">
        <button onClick={() => setSelected(null)} className="text-xs text-primary mb-3">← Kembali</button>
        <h1 className="text-lg font-extrabold">{selected.nama_siswa}</h1>
        <p className="text-xs text-muted-foreground mb-3">{selected.kelas} • {selected.tempat_magang}</p>
        <a href={waHref} target="_blank" rel="noreferrer" className="block mb-4">
          <Button type="button" className="w-full h-11 gap-2 bg-green-600 hover:bg-green-700">
            <Share2 className="w-4 h-4" /> Kirim Link Rekap via WhatsApp
          </Button>
        </a>
        <Button
          type="button"
          variant="destructive"
          className="w-full h-11 gap-2 mb-4"
          onClick={() => handleDelete(selected)}
        >
          <Trash2 className="w-4 h-4" /> Hapus Siswa Ini
        </Button>
        {att.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada absensi.</p>
        ) : (
          <div className="space-y-3">
            {att.map((r) => (
              <div key={r.id} className="flex gap-3 bg-card rounded-xl p-3 border border-border">
                <AttendancePhoto
                  photoUrl={r.photo_url}
                  alt="Foto"
                  asLink
                  className="w-16 h-24 object-cover rounded-lg bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase">{r.jenis}</p>
                  <p className="text-sm font-semibold">{formatTanggal(r.waktu)}</p>
                  <p className="text-xs text-muted-foreground">{formatJam(r.waktu)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r.nama_lokasi}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus data siswa?</AlertDialogTitle>
              <AlertDialogDescription>
                Siswa <strong>{deleteTarget?.nama_siswa}</strong> akan dihapus secara permanen.
                Semua data absensi terkait juga akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Ya, Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-extrabold mb-3">Rekap Siswa</h1>
      <RekapRingkasanCard />
      <div className="mb-3">
        <NotifikasiHpCard />
      </div>
      <Link to="/rekap-semua" className="block mb-3">
        <Button type="button" variant="outline" className="w-full h-11 gap-2">
          <Globe2 className="w-4 h-4" /> Lihat Rekap Semua Siswa
        </Button>
      </Link>
      <Input placeholder="Cari nama / kelas / tempat magang" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
      {filteredFav.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">
            ⭐ Siswa Favorit ({favStudents.length})
          </p>
          <div className="space-y-2 mb-4">
            {filteredFav.map((s) => (
              <StudentRow
                key={s.id}
                s={s}
                isFav
                onOpen={() => setSelected(s)}
                onToggleFav={() => toggleFavorite(s.id)}
                onDelete={() => handleDelete(s)}
              />
            ))}
          </div>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Semua Siswa</p>
        </>
      )}
      <div className="space-y-2">
        {filteredOther.map((s) => (
          <StudentRow
            key={s.id}
            s={s}
            isFav={false}
            onOpen={() => setSelected(s)}
            onToggleFav={() => toggleFavorite(s.id)}
            onDelete={() => handleDelete(s)}
          />
        ))}
      </div>
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data siswa?</AlertDialogTitle>
            <AlertDialogDescription>
              Siswa <strong>{deleteTarget?.nama_siswa}</strong> akan dihapus secara permanen.
              Semua data absensi terkait juga akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}