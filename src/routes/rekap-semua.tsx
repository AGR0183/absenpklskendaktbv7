import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRekapAll, setAttendanceJenis } from "@/lib/rekap.functions";
import { syncFavoritByGuruPhone } from "@/lib/favorit.functions";
import { formatTanggal, formatJamShort, todayISO } from "@/lib/format";
import { hitungKehadiran, hitungAlpa, formatPersen, formatHari } from "@/lib/kehadiran";
import { makeIsLibur, type JadwalKerja } from "@/lib/libur";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LogIn, LogOut, FileText, HeartPulse, MapPin, Star, Check, ChevronsUpDown, Users, CalendarX, Filter, ListChecks, ArrowUp, ChevronDown, LayoutDashboard, Building2, MoreHorizontal, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportRekapMatriks } from "@/lib/export-rekap-matriks";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { AttendancePhoto } from "@/components/attendance-photo";
import { BelumAbsenCard } from "@/components/admin/belum-absen-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatJam } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SuratPanggilanDialog, type SuratDialogState } from "@/components/surat-panggilan-dialog";

export const Route = createFileRoute("/rekap-semua")({
  component: RekapSemuaPage,
  head: () => ({
    meta: [
      { title: "Rekap Semua Siswa SIAP PKL" },
      { name: "description", content: "Rekap absensi seluruh siswa PKL SMKN 2 Kotabaru melalui SIAP PKL." },
      { property: "og:title", content: "Rekap Semua Siswa SIAP PKL" },
      { property: "og:description", content: "Rekap absensi seluruh siswa PKL SMKN 2 Kotabaru melalui SIAP PKL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Profile = { id: string; nama_siswa: string | null; kelas: string | null; tempat_magang: string | null };
type Att = {
  id: string;
  user_id: string;
  jenis: string;
  tanggal: string;
  waktu: string;
  nama_lokasi: string | null;
  photo_url: string | null;
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function RekapSemuaPage() {
  const fetchAll = useServerFn(getRekapAll);
  const syncFavorit = useServerFn(syncFavoritByGuruPhone);
  const { user, isStaff, isAdmin, signOut } = useAuth();
  const setJenisAbsen = useServerFn(setAttendanceJenis);
  const [activeMenu, setActiveMenu] = useState("sec-ringkasan");

  useEffect(() => {
    const sectionIds = ["sec-ringkasan", "sec-belum", "sec-filter", "sec-daftar"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveMenu(visible.target.id);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0, 0.1, 0.25] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [jadwal, setJadwal] = useState<Record<string, JadwalKerja>>({});
  const [hariGlobal, setHariGlobal] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q, 350);
  const [kelas, setKelas] = useState<string>("all");
  const [tempat, setTempat] = useState<string>("all");
  const [jenis, setJenis] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>(todayStr());
  const [favorites, setFavorites] = useState<string[]>([]);
  const [photoView, setPhotoView] = useState<{ att: Att; nama: string; jenis: string } | null>(null);
  const [suratDialog, setSuratDialog] = useState<SuratDialogState>(null);
  const [alpaSort, setAlpaSort] = useState<{ key: "nama" | "tanggal" | "hari" | "tindakan"; direction: "asc" | "desc" }>({
    key: "tanggal",
    direction: "desc",
  });

  const toggleAlpaSort = (key: typeof alpaSort.key) => {
    setAlpaSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  useEffect(() => {
    if (!user?.id || !isStaff) return;
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
  }, [user?.id, isStaff]);

  const toggleFavorite = async (id: string) => {
    if (!user?.id) return;
    const isFav = favorites.includes(id);
    setFavorites((prev) => (isFav ? prev.filter((x) => x !== id) : [...prev, id]));
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
      setFavorites((prev) => (isFav ? [...prev, id] : prev.filter((x) => x !== id)));
      toast.error("Gagal menyimpan favorit", { description: e?.message });
    }
  };

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetchAll({});
          if (cancelled) return;
          setProfiles(r.profiles as Profile[]);
          setAtt(r.attendance as Att[]);
          setJadwal(((r as any).jadwal ?? {}) as Record<string, JadwalKerja>);
          setHariGlobal((((r as any).hariAktifGlobal ?? [1, 2, 3, 4, 5, 6]) as number[]));
          setErr(null);
          setLoading(false);
          return;
        } catch (e: any) {
          lastErr = e as Error;
          await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
        }
      }
      if (cancelled) return;
      setErr(lastErr?.message ?? "Gagal memuat data");
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchAll, reloadKey]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const kelasOptions = useMemo(
    () => Array.from(new Set(profiles.map((p) => p.kelas).filter(Boolean))) as string[],
    [profiles],
  );
  const tempatOptions = useMemo(
    () => Array.from(new Set(profiles.map((p) => p.tempat_magang).filter(Boolean))) as string[],
    [profiles],
  );

  const rowsBase = useMemo(() => {
    const term = qDebounced.trim().toLowerCase();
    return att.filter((r) => {
      const p = profileMap.get(r.user_id);
      if (!p) return false;
      if (kelas !== "all" && p.kelas !== kelas) return false;
      if (tempat !== "all" && p.tempat_magang !== tempat) return false;
      if (from && r.tanggal < from) return false;
      if (to && r.tanggal > to) return false;
      if (term) {
        const hay = `${p.nama_siswa ?? ""} ${p.kelas ?? ""} ${p.tempat_magang ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [att, profileMap, qDebounced, kelas, tempat, from, to]);

  const rows = useMemo(
    () =>
      jenis === "all" || jenis === "alpa"
        ? rowsBase
        : rowsBase.filter((r) => r.jenis === jenis),
    [rowsBase, jenis],
  );

  // Pagination daftar absensi (25 baris/halaman) agar HP tidak merender ribuan kartu.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [qDebounced, kelas, tempat, jenis, from, to]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const rowsPage = useMemo(
    () => rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [rows, pageSafe],
  );

  const counts = useMemo(
    () =>
      rowsBase.reduce<Record<string, number>>((acc, r) => {
        acc[r.jenis] = (acc[r.jenis] ?? 0) + 1;
        return acc;
      }, {}),
    [rowsBase],
  );

  // ALPA = hari efektif (bukan libur) yang (sebagian atau seluruhnya) tidak diabsen,
  // dihitung sejak awal magang (absen pertama siswa) sampai hari ini.
  // - tidak ada catatan apa pun → 1 hari
  // - hanya masuk (tidak pulang), tanpa izin/sakit → 0,5 hari
  // - masuk + pulang, izin, atau sakit → 0 hari (bukan alpa)
  const alpaItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    const allowed = new Set(
      profiles
        .filter((p) => {
          if (kelas !== "all" && p.kelas !== kelas) return false;
          if (tempat !== "all" && p.tempat_magang !== tempat) return false;
          if (term) {
            const hay = `${p.nama_siswa ?? ""} ${p.kelas ?? ""} ${p.tempat_magang ?? ""}`.toLowerCase();
            if (!hay.includes(term)) return false;
          }
          return true;
        })
        .map((p) => p.id),
    );
    // peta user → tanggal → kumpulan jenis absen (tanpa filter tanggal) untuk tahu awal magang
    const byUser = new Map<string, Map<string, Set<string>>>();
    for (const r of att) {
      if (!allowed.has(r.user_id)) continue;
      let dm = byUser.get(r.user_id);
      if (!dm) byUser.set(r.user_id, (dm = new Map()));
      let s = dm.get(r.tanggal);
      if (!s) dm.set(r.tanggal, (s = new Set()));
      s.add(r.jenis);
    }
    const today = todayISO();
    const items: { user_id: string; tanggal: string; hari: number; keterangan: string }[] = [];
    for (const [uid, dm] of byUser) {
      const sorted = Array.from(dm.keys()).sort();
      const awal = sorted[0];
      if (!awal) continue;
      const start = from && from > awal ? from : awal;
      const end = to && to < today ? to : today;
      const { items: userItems } = hitungAlpa(dm, makeIsLibur(jadwal[uid], hariGlobal), start, end);
      for (const it of userItems) items.push({ user_id: uid, ...it });
    }
    return items.sort(
      (a, b) =>
        b.tanggal.localeCompare(a.tanggal) ||
        (profileMap.get(a.user_id)?.nama_siswa ?? "").localeCompare(
          profileMap.get(b.user_id)?.nama_siswa ?? "",
        ),
    );
  }, [att, profiles, q, kelas, tempat, from, to, jadwal, hariGlobal, profileMap]);

  const sortedAlpaItems = useMemo(() => {
    const direction = alpaSort.direction === "asc" ? 1 : -1;
    return [...alpaItems].sort((a, b) => {
      const profileA = profileMap.get(a.user_id);
      const profileB = profileMap.get(b.user_id);
      let compared = 0;
      if (alpaSort.key === "nama") {
        compared = (profileA?.nama_siswa ?? "").localeCompare(profileB?.nama_siswa ?? "", "id");
      } else if (alpaSort.key === "tanggal") {
        compared = a.tanggal.localeCompare(b.tanggal);
      } else if (alpaSort.key === "hari") {
        compared = a.hari - b.hari;
      } else {
        compared = Number(Boolean(profileA)) - Number(Boolean(profileB));
      }
      return compared * direction || (profileA?.nama_siswa ?? "").localeCompare(profileB?.nama_siswa ?? "", "id");
    });
  }, [alpaItems, alpaSort, profileMap]);

  const alpaCount = alpaItems.reduce((s, it) => s + it.hari, 0);

  const kehadiranPerSiswa = useMemo(() => {
    const m = new Map<string, ReturnType<typeof hitungKehadiran>>();
    const byUser = new Map<string, Att[]>();

    // Pakai seluruh data absensi siswa (tanpa filter tanggal/jenis) agar
    // angka hari & persentase sama persis dengan halaman profil siswa.
    for (const r of att) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(r);
    }
    for (const [uid, list] of byUser)
      m.set(uid, hitungKehadiran(list, makeIsLibur(jadwal[uid], hariGlobal)));
    return m;
  }, [att, jadwal, hariGlobal]);

  // Ringkasan per-siswa: hari unik izin & sakit
  const ringkasanPerSiswa = useMemo(() => {
    const m = new Map<string, { izinHari: number; sakitHari: number }>();
    const setMap = new Map<string, { izin: Set<string>; sakit: Set<string> }>();
    for (const r of att) {
      if (!setMap.has(r.user_id)) setMap.set(r.user_id, { izin: new Set(), sakit: new Set() });
      const s = setMap.get(r.user_id)!;
      if (r.jenis === "izin") s.izin.add(r.tanggal);
      else if (r.jenis === "sakit") s.sakit.add(r.tanggal);
    }
    for (const [uid, s] of setMap) m.set(uid, { izinHari: s.izin.size, sakitHari: s.sakit.size });
    return m;
  }, [att]);

  const siswaList = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    return ids
      .map((id) => profileMap.get(id))
      .filter((p): p is Profile => !!p)
      .sort((a, b) => {
        const fa = favSet.has(a.id) ? 0 : 1;
        const fb = favSet.has(b.id) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return (a.nama_siswa ?? "").localeCompare(b.nama_siswa ?? "");
      });
  }, [rows, profileMap, favSet]);

  const kehadiranTotal = useMemo(() => {
    const items = Array.from(kehadiranPerSiswa.values()).filter((k) => k.totalHari > 0);
    if (items.length === 0) return 0;
    return items.reduce((s, k) => s + k.persen, 0) / items.length;
  }, [kehadiranPerSiswa]);

  const favoriteRows = useMemo(() => rows.filter((r) => favSet.has(r.user_id)), [rows, favSet]);

  const today = todayStr();
  const todayByUser = useMemo(() => {
    const m = new Map<string, { masuk?: Att; pulang?: Att; izin?: Att; sakit?: Att }>();
    for (const r of att) {
      if (r.tanggal !== today) continue;
      const cur = m.get(r.user_id) ?? {};
      if (r.jenis === "masuk") cur.masuk = r;
      else if (r.jenis === "pulang") cur.pulang = r;
      else if (r.jenis === "izin") cur.izin = r;
      else if (r.jenis === "sakit") cur.sakit = r;
      m.set(r.user_id, cur);
    }
    return m;
  }, [att, today]);

  const favoriteProfileMap = useMemo(() => {
    const term = q.trim().toLowerCase();
    const m = new Map<string, Profile>();
    for (const id of favorites) {
      const p = profileMap.get(id);
      if (!p) continue;
      if (kelas !== "all" && p.kelas !== kelas) continue;
      if (tempat !== "all" && p.tempat_magang !== tempat) continue;
      if (term) {
        const hay = `${p.nama_siswa ?? ""} ${p.kelas ?? ""} ${p.tempat_magang ?? ""}`.toLowerCase();
        if (!hay.includes(term)) continue;
      }
      m.set(id, p);
    }
    return m;
  }, [favorites, profileMap, q, kelas, tempat]);

  const exportExcel = () => {
    if (favoriteProfileMap.size === 0) {
      toast.warning("Belum ada siswa favorit", {
        description: "Tandai siswa dengan ikon bintang terlebih dahulu.",
      });
      return;
    }
    exportRekapMatriks({
      rows: favoriteRows,
      profiles: favoriteProfileMap,
      from,
      to,
      isLibur: (uid, ymd) => makeIsLibur(jadwal[uid], hariGlobal)(ymd),
    });
  };

  return (
    <div id="rekap-top" className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6 lg:flex-row lg:items-start lg:gap-6 lg:px-6 xl:px-8">
      <RekapMenu isAdmin={isAdmin} activeMenu={activeMenu} onMenuChange={setActiveMenu} />
      <main className="min-w-0 w-full mx-auto lg:mx-0 lg:flex-1">
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="gap-1 h-8 text-xs"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="w-3.5 h-3.5" /> Keluar
        </Button>
      </div>
      <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: "var(--gradient-brand)" }}>
        <p className="text-xs opacity-90 uppercase tracking-wider font-bold">Rekap Semua Siswa</p>
        <h1 className="text-xl font-extrabold mt-1">SMKN 2 Kotabaru — PKL</h1>
        <p className="text-xs opacity-90">{profiles.length} siswa terdaftar</p>
      </div>

      <div id="sec-ringkasan">
      {siswaList.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Ringkasan per Siswa
          </p>
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-3 md:gap-y-2 space-y-2 md:space-y-0">
            <div className="hidden md:block" />
            <div className="grid grid-cols-4 w-full text-[9px] font-bold uppercase tracking-tight bg-muted/60 border border-border rounded-t-md">
              <div className="px-1 py-1 col-span-4 flex justify-between border-b border-border text-[10px]">
                <span>Hari Ini</span>
                <span className="text-muted-foreground normal-case font-semibold">{formatTanggal(today)}</span>
              </div>
              <div className="px-1 py-1 border-r border-border text-success text-center">Masuk</div>
              <div className="px-1 py-1 border-r border-border text-primary text-center">Pulang</div>
              <div className="px-1 py-1 border-r border-border text-accent-foreground text-center">Izin</div>
              <div className="px-1 py-1 text-destructive text-center">Sakit</div>
            </div>
            {siswaList.map((p) => {
              const k = kehadiranPerSiswa.get(p.id);
              const r = ringkasanPerSiswa.get(p.id);
              const isFav = favSet.has(p.id);
              const t = todayByUser.get(p.id);
              return (
                <React.Fragment key={p.id}>
                <div
                  className="bg-card rounded-xl p-3 border border-border hover:border-primary transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isStaff && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(p.id);
                        }}
                        aria-label={isFav ? "Hapus dari favorit" : "Tandai favorit"}
                        className="shrink-0 p-0.5"
                      >
                        <Star
                          className={`w-4 h-4 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      </button>
                    )}
                    <Link
                      to="/rekap/$userId"
                      params={{ userId: p.id }}
                      className="flex-1 min-w-0"
                    >
                      <p className="font-bold text-sm truncate">{p.nama_siswa || "(tanpa nama)"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.kelas} • {p.tempat_magang}
                      </p>
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SiswaStat
                      label="MASUK"
                      value={k ? formatHari(k.hadir) : "0"}
                      sub={k && k.totalHari > 0 ? formatPersen(k.persen) : "0%"}
                      color="text-success"
                      subColor="text-success"
                    />
                    <SiswaStat
                      label="IZIN"
                      value={String(r?.izinHari ?? 0)}
                      sub="hari"
                      color="text-accent-foreground"
                    />
                    <SiswaStat
                      label="SAKIT"
                      value={String(r?.sakitHari ?? 0)}
                      sub="hari"
                      color="text-destructive"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 w-full text-[11px] border border-border rounded-md bg-card overflow-hidden">
                  <TodayCell att={t?.masuk} nama={p.nama_siswa ?? ""} jenis="masuk" color="text-success" onView={setPhotoView} />
                  <TodayCell att={t?.pulang} nama={p.nama_siswa ?? ""} jenis="pulang" color="text-primary" onView={setPhotoView} />
                  <TodayCell att={t?.izin} nama={p.nama_siswa ?? ""} jenis="izin" color="text-accent-foreground" onView={setPhotoView} />
                  <TodayCell att={t?.sakit} nama={p.nama_siswa ?? ""} jenis="sakit" color="text-destructive" onView={setPhotoView} last />
                </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
        <BackToMenu />
      </div>
      <div id="sec-belum">
        <BelumAbsenCard />
        <BackToMenu />
      </div>

      <div id="sec-filter" className="space-y-2 mb-3">
        <Input placeholder="Cari nama / kelas / tempat" value={q} onChange={(e) => setQ(e.target.value)} />
        <SearchableSelect
          value={kelas}
          onChange={setKelas}
          options={kelasOptions}
          allLabel="Semua Kelas"
          searchPlaceholder="Cari kelas…"
        />
        <SearchableSelect
          value={tempat}
          onChange={setTempat}
          options={tempatOptions}
          allLabel="Semua Tempat"
          searchPlaceholder="Cari tempat magang…"
        />
        <Select value={jenis} onValueChange={setJenis}>
          <SelectTrigger><SelectValue placeholder="Jenis" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenis</SelectItem>
            <SelectItem value="masuk">Masuk</SelectItem>
            <SelectItem value="pulang">Pulang</SelectItem>
            <SelectItem value="izin">Izin</SelectItem>
            <SelectItem value="sakit">Sakit</SelectItem>
            <SelectItem value="alpa">Alpa</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Dari</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Sampai</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button type="button" onClick={exportExcel} disabled={favoriteProfileMap.size === 0} className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90" size="sm">
          <Download className="w-4 h-4" /> Ekspor Excel Favorit ({favoriteProfileMap.size} siswa)
        </Button>
        <BackToMenu />
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {(["masuk", "pulang", "izin", "sakit"] as const).map((j) => (
          <Stat
            key={j}
            label={j}
            value={counts[j] ?? 0}
            active={jenis === j}
            onClick={() => {
              setJenis(jenis === j ? "all" : j);
              document.getElementById("sec-daftar")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        ))}
        <Stat
          label="alpa"
          value={formatHari(alpaCount)}
          active={jenis === "alpa"}
          onClick={() => {
            setJenis(jenis === "alpa" ? "all" : "alpa");
            document.getElementById("sec-daftar")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rata-rata Kehadiran</p>
          <p className="text-2xl font-extrabold text-primary">{formatPersen(kehadiranTotal)}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, kehadiranTotal)}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {kehadiranPerSiswa.size} siswa pada filter ini. masuk+pulang = 1 hari, hanya masuk = 0,5 hari.
        </p>
      </div>


      <div id="sec-daftar" />
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : err ? (
        <p className="text-sm text-destructive">{err}</p>
      ) : jenis === "alpa" ? (
        alpaItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada data alpa sesuai filter.</p>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[420px]">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    {(["nama", "tanggal", "hari", "tindakan"] as const).map((key) => (
                      <th
                        key={key}
                        className={`px-2 py-1 ${key === "hari" ? "text-center" : key === "tindakan" ? "text-right" : "text-left"}`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAlpaSort(key)}
                          className={`h-7 gap-1 px-1 text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground ${key === "tindakan" ? "ml-auto" : key === "hari" ? "mx-auto" : ""}`}
                          aria-label={`Urutkan berdasarkan ${key}`}
                        >
                          {key}
                          <ChevronsUpDown className={`size-3 ${alpaSort.key === key ? "text-primary" : "opacity-45"}`} />
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAlpaItems.map((it) => {
                    const p = profileMap.get(it.user_id);
                    return (
                      <tr key={`${it.user_id}-${it.tanggal}`} className="border-t border-border">
                        <td className="px-3 py-2">
                          <p className="font-bold truncate">{p?.nama_siswa || "(tanpa nama)"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {p?.kelas} • {p?.tempat_magang}
                          </p>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <p>{formatTanggal(`${it.tanggal}T00:00:00`)}</p>
                          <p className="text-[10px] text-muted-foreground">{it.keterangan}</p>
                        </td>
                        <td className="px-3 py-2 text-center font-bold whitespace-nowrap">{formatHari(it.hari)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && (
                              <Select
                                value=""
                                onValueChange={async (v) => {
                                  try {
                                    await setJenisAbsen({
                                      data: { user_id: it.user_id, tanggal: it.tanggal, jenis: v as any },
                                    });
                                    const labelMap: Record<string, string> = {
                                      masuk: "Absen Masuk",
                                      pulang: "Absen Pulang",
                                      izin: "Izin",
                                      sakit: "Sakit",
                                      libur: "Libur",
                                      peringatan: "Peringatan",
                                      sp1: "SP - 1",
                                      sp2: "SP - 2",
                                      sp3: "SP - 3",
                                    };
                                    toast.success(`Ditandai sebagai ${labelMap[v] ?? v}`);
                                    setReloadKey((k) => k + 1);
                                  } catch (e: any) {
                                    toast.error("Gagal mengubah", { description: e?.message });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 w-[112px] text-[10px]">
                                  <SelectValue placeholder="Ubah jenis" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="masuk">Absen Masuk</SelectItem>
                                  <SelectItem value="pulang">Absen Pulang</SelectItem>
                                  <SelectItem value="izin">Izin</SelectItem>
                                  <SelectItem value="sakit">Sakit</SelectItem>
                                  <SelectItem value="libur">Libur</SelectItem>
                                  <SelectItem value="peringatan">Peringatan</SelectItem>
                                  <SelectItem value="sp1">SP - 1</SelectItem>
                                  <SelectItem value="sp2">SP - 2</SelectItem>
                                  <SelectItem value="sp3">SP - 3</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <Link to="/rekap/$userId" params={{ userId: it.user_id }}>
                              <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]">
                                Profil
                              </Button>
                            </Link>
                            {isAdmin && p && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="size-7"
                                    aria-label={`Unduh surat untuk ${p.nama_siswa || "siswa"}`}
                                    title="Unduh surat"
                                  >
                                    <MoreHorizontal className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setSuratDialog({
                                        jenis: "ortu",
                                        nama: p.nama_siswa ?? "-",
                                        kelas: p.kelas ?? "-",
                                        tempatMagang: p.tempat_magang ?? "-",
                                      })
                                    }
                                  >
                                    <Download className="size-4" />
                                    Unduh Surat Panggilan Ortu (.docx)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setSuratDialog({
                                        jenis: "dudi",
                                        nama: p.nama_siswa ?? "-",
                                        kelas: p.kelas ?? "-",
                                        tempatMagang: p.tempat_magang ?? "-",
                                      })
                                    }
                                  >
                                    <Building2 className="size-4" />
                                    Unduh Surat Izin ke DUDI (.docx)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada data sesuai filter.</p>
      ) : (
        <div className="space-y-2">
          {rowsPage.map((r) => {
            const p = profileMap.get(r.user_id);
            const k = kehadiranPerSiswa.get(r.user_id);
            return <RowItem key={r.id} r={r} p={p} kehadiran={k} />;
          })}
        </div>
      )}

      {jenis !== "alpa" && rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={pageSafe <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Sebelumnya
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Halaman {pageSafe} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Berikutnya
          </Button>
        </div>
      )}

      <p className="text-[10px] text-center text-muted-foreground mt-8">
        Menampilkan {jenis === "alpa" ? rows.length : rowsPage.length} dari {rows.length} hasil filter ({att.length} total absensi)
      </p>
      <BackToMenu />

      <Dialog open={!!photoView} onOpenChange={(o) => !o && setPhotoView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {photoView?.nama} — {photoView?.jenis.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {photoView?.att.photo_url ? (
            <AttendancePhoto
              photoUrl={photoView.att.photo_url}
              alt="Foto absen"
              className="w-full h-auto rounded-lg bg-muted"
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Foto tidak tersedia / telah dihapus.</p>
          )}
          {photoView?.att && (
            <p className="text-xs text-muted-foreground text-center">
              {formatJam(photoView.att.waktu)}
              {photoView.att.nama_lokasi ? ` • ${photoView.att.nama_lokasi}` : ""}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <SuratPanggilanDialog state={suratDialog} onOpenChange={setSuratDialog} />
      </main>
    </div>
  );
}

function TodayCell({
  att,
  nama,
  jenis,
  color,
  last,
  onView,
}: {
  att?: Att;
  nama: string;
  jenis: string;
  color: string;
  last?: boolean;
  onView: (v: { att: Att; nama: string; jenis: string }) => void;
}) {
  const border = last ? "" : "border-r border-border";
  if (!att) {
    return <div className={`px-1 py-2 ${border} text-center text-muted-foreground tabular-nums`}>—</div>;
  }
  return (
    <button
      type="button"
      onClick={() => onView({ att, nama, jenis })}
      className={`px-1 py-2 ${border} font-semibold ${color} text-center tabular-nums hover:bg-muted/60 transition leading-tight`}
    >
      {formatJamShort(att.waktu)}
    </button>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function RekapMenu({
  isAdmin,
  activeMenu,
  onMenuChange,
}: {
  isAdmin: boolean;
  activeMenu: string;
  onMenuChange: (targetId: string) => void;
}) {
  const contents = (
    <nav aria-label="Menu Rekap Absensi" className="space-y-4">
      {isAdmin && (
        <MenuGroup label="Admin">
          <Button asChild variant="ghost" className="h-9 w-full justify-start px-2 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:text-primary">
            <Link to="/admin"><LayoutDashboard /> Dashboard Admin</Link>
          </Button>
        </MenuGroup>
      )}
      <MenuGroup label="Siswa">
        <RekapMenuButton icon={<Users />} label="Ringkasan Siswa" targetId="sec-ringkasan" tone="secondary" active={activeMenu === "sec-ringkasan"} onSelect={onMenuChange} />
        <RekapMenuButton icon={<CalendarX />} label="Belum Absen" targetId="sec-belum" tone="destructive" active={activeMenu === "sec-belum"} onSelect={onMenuChange} />
      </MenuGroup>
      <MenuGroup label="Rekap Absensi">
        <RekapMenuButton icon={<Filter />} label="Filter & Ekspor" targetId="sec-filter" tone="accent" active={activeMenu === "sec-filter"} onSelect={onMenuChange} />
        <RekapMenuButton icon={<ListChecks />} label="Daftar Absensi" targetId="sec-daftar" tone="primary" active={activeMenu === "sec-daftar"} onSelect={onMenuChange} />
      </MenuGroup>
    </nav>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-6 lg:block">
        <div className="rounded-lg border border-sidebar-border bg-sidebar p-3 shadow-sm">
          <div className="mb-4 border-b border-sidebar-border px-2 pb-3">
            <p className="text-sm font-extrabold text-sidebar-foreground">Menu Rekap</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">SIAP PKL</p>
          </div>
          {contents}
        </div>
      </aside>
      <details className="group rounded-lg border border-border bg-card shadow-sm lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><ListChecks className="size-4 text-primary" /> Menu Rekap</span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border p-3">{contents}</div>
      </details>
    </>
  );
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-2 text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

const menuToneClasses = {
  secondary: "text-secondary [&_svg]:text-secondary data-[active=true]:bg-secondary data-[active=true]:text-secondary-foreground data-[active=true]:[&_svg]:text-secondary-foreground",
  destructive: "text-destructive [&_svg]:text-destructive data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:[&_svg]:text-destructive-foreground",
  accent: "text-accent-foreground [&_svg]:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[active=true]:[&_svg]:text-accent-foreground",
  primary: "text-primary [&_svg]:text-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:[&_svg]:text-primary-foreground",
};

function RekapMenuButton({
  icon,
  label,
  targetId,
  tone,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  targetId: string;
  tone: keyof typeof menuToneClasses;
  active: boolean;
  onSelect: (targetId: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-active={active}
      aria-current={active ? "location" : undefined}
      className={`h-9 w-full justify-start px-2 text-xs font-medium transition-colors hover:bg-sidebar-accent ${menuToneClasses[tone]}`}
      onClick={() => {
        onSelect(targetId);
        scrollToId(targetId);
      }}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

function BackToMenu() {
  return (
    <div className="mt-3 mb-4">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 gap-1 text-xs"
        onClick={() => scrollToId("rekap-top")}
      >
        <ArrowUp className="w-3.5 h-3.5" /> Kembali ke menu
      </Button>
    </div>
  );
}

function SearchableSelect({
  value,
  onChange,
  options,
  allLabel,
  searchPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value === "all" ? allLabel : value}</span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange("all");
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === "all" ? "opacity-100" : "opacity-0"}`} />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === o ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{o}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Stat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <div className="bg-card border border-border rounded-xl p-2 text-center">
        <p className="text-lg font-extrabold">{value}</p>
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-2 text-center border transition ${
        active
          ? "bg-primary/10 border-primary"
          : "bg-card border-border hover:border-primary"
      }`}
    >
      <p className={`text-lg font-extrabold ${active ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
    </button>
  );
}

function SiswaStat({
  label,
  value,
  sub,
  color,
  subColor,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  subColor?: string;
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-2 text-center">
      <p className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</p>
      <p className="text-xl font-extrabold leading-tight">{value}</p>
      <p className={`text-[10px] ${subColor ?? "text-muted-foreground"}`}>{sub}</p>
    </div>
  );
}

function jenisIcon(j: string) {
  if (j === "masuk") return <LogIn className="w-3.5 h-3.5 text-success" />;
  if (j === "pulang") return <LogOut className="w-3.5 h-3.5 text-primary" />;
  if (j === "izin") return <FileText className="w-3.5 h-3.5 text-accent-foreground" />;
  return <HeartPulse className="w-3.5 h-3.5 text-destructive" />;
}

function RowItem({ r, p, kehadiran }: { r: Att; p?: Profile; kehadiran?: { hadir: number; totalHari: number; persen: number } }) {
  return (
    <div className="flex gap-3 bg-card rounded-xl p-3 border border-border">
      {r.photo_url ? (
        <AttendancePhoto
          photoUrl={r.photo_url}
          alt="Foto"
          asLink
          className="w-14 h-20 object-cover rounded-lg bg-muted"
        />
      ) : (
        <div className="w-14 h-20 rounded-lg bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
          foto dihapus
        </div>
      )}
      <Link
        to="/rekap/$userId"
        params={{ userId: r.user_id }}
        className="flex-1 min-w-0 hover:opacity-80 transition"
      >
        <p className="text-sm font-bold truncate">{p?.nama_siswa || "(tanpa nama)"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{p?.kelas} • {p?.tempat_magang}</p>
        {kehadiran && kehadiran.totalHari > 0 && (
          <p className="text-[10px] text-primary font-semibold">
            Hadir {formatPersen(kehadiran.persen)} ({formatHari(kehadiran.hadir)}/{kehadiran.totalHari} hari)
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {jenisIcon(r.jenis)}
          <span className="text-[11px] font-bold uppercase">{r.jenis}</span>
          <span className="text-[11px] text-muted-foreground">• {formatTanggal(r.waktu)} {formatJam(r.waktu)}</span>
        </div>
        {r.nama_lokasi && (
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {r.nama_lokasi}
          </p>
        )}
      </Link>
    </div>
  );
}