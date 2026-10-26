import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRekapAll } from "@/lib/rekap.functions";
import { hitungKehadiran, formatPersen } from "@/lib/kehadiran";
import { makeIsLibur, type JadwalKerja } from "@/lib/libur";
import { useAuth } from "@/hooks/use-auth";
import { SertifikatButton } from "@/components/sertifikat-button";
import {
  buatSertifikat,
  SERTIFIKAT_MIN_PERSEN,
  SERTIFIKAT_RILIS_LABEL,
  sertifikatSudahRilis,
} from "@/lib/sertifikat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Award, Check, ChevronsUpDown, Download, Lock, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sertifikat-admin")({
  component: SertifikatAdminPage,
  head: () => ({
    meta: [
      { title: "Sertifikat Absensi Siswa — Admin" },
      { name: "description", content: "Kelola dan unduh sertifikat penghargaan absensi siswa PKL SMKN 2 Kotabaru melalui SIAP PKL." },
      { property: "og:title", content: "Sertifikat Absensi Siswa — Admin" },
      { property: "og:description", content: "Kelola dan unduh sertifikat penghargaan absensi siswa PKL." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Profile = { id: string; nama_siswa: string | null; kelas: string | null; tempat_magang: string | null };
type Att = { user_id: string; jenis: string; tanggal: string };

function SertifikatAdminPage() {
  const { isAdmin, isStaff } = useAuth();
  const fetchAll = useServerFn(getRekapAll);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [jadwal, setJadwal] = useState<Record<string, JadwalKerja>>({});
  const [hariGlobal, setHariGlobal] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kelas, setKelas] = useState("all");
  const [tempat, setTempat] = useState("all");
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const rilis = sertifikatSudahRilis();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r: any = await fetchAll({});
        if (cancelled) return;
        setProfiles(r.profiles as Profile[]);
        setAtt(r.attendance as Att[]);
        setJadwal((r.jadwal ?? {}) as Record<string, JadwalKerja>);
        setHariGlobal((r.hariAktifGlobal ?? [1, 2, 3, 4, 5, 6]) as number[]);
      } catch (e: any) {
        toast.error("Gagal memuat data", { description: e?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const attByUser = useMemo(() => {
    const m = new Map<string, Att[]>();
    for (const a of att) {
      if (!m.has(a.user_id)) m.set(a.user_id, []);
      m.get(a.user_id)!.push(a);
    }
    return m;
  }, [att]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return profiles
      .filter((p) => {
        if (kelas !== "all" && p.kelas !== kelas) return false;
        if (tempat !== "all" && p.tempat_magang !== tempat) return false;
        if (term) {
          const hay = `${p.nama_siswa ?? ""} ${p.kelas ?? ""} ${p.tempat_magang ?? ""}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .map((p) => {
        const isLibur = makeIsLibur(jadwal[p.id] ?? { hari_aktif: null, tanggal_libur: [] }, hariGlobal);
        const { persen } = hitungKehadiran(attByUser.get(p.id) ?? [], isLibur);
        return { profile: p, persen, layak: persen >= SERTIFIKAT_MIN_PERSEN };
      })
      .sort((a, b) => b.persen - a.persen);
  }, [profiles, attByUser, jadwal, hariGlobal, q, kelas, tempat]);

  const layakList = useMemo(() => items.filter((i) => i.layak), [items]);

  const kelasOptions = useMemo(
    () => Array.from(new Set(profiles.map((p) => p.kelas).filter(Boolean))) as string[],
    [profiles],
  );
  const tempatOptions = useMemo(
    () => Array.from(new Set(profiles.map((p) => p.tempat_magang).filter(Boolean))) as string[],
    [profiles],
  );

  const unduhSemua = async () => {
    if (!layakList.length) return;
    setBulk({ done: 0, total: layakList.length });
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < layakList.length; i++) {
        const it = layakList[i]!;
        const nama = it.profile.nama_siswa || "Siswa";
        const blob = await buatSertifikat({
          nama,
          kelas: it.profile.kelas || "-",
          tempat: it.profile.tempat_magang || "-",
          persen: it.persen,
        });
        const safe = nama.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
        zip.file(`sertifikat-${safe || "siswa"}-${i + 1}.png`, blob);
        setBulk({ done: i + 1, total: layakList.length });
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sertifikat-absensi-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`${layakList.length} sertifikat diunduh`);
    } catch (e: any) {
      toast.error("Gagal mengunduh sertifikat", { description: e?.message ?? String(e) });
    } finally {
      setBulk(null);
    }
  };

  if (!isStaff && !isAdmin) {
    return (
      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
        Halaman ini khusus admin.
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Award className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-extrabold">Sertifikat Absensi</h1>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Sertifikat terbit untuk siswa dengan kehadiran ≥ {SERTIFIKAT_MIN_PERSEN}%.
      </p>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari nama, kelas, tempat PKL…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={kelas} onValueChange={setKelas}>
            <SelectTrigger><SelectValue placeholder="Kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kelas</SelectItem>
              {kelasOptions.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchableTempatSelect value={tempat} onChange={setTempat} options={tempatOptions} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{layakList.length} siswa berhak sertifikat</p>
          <p className="text-[11px] text-muted-foreground">dari {items.length} siswa pada filter ini</p>
        </div>
        {rilis ? (
          <Button
            size="sm"
            className="gap-2"
            disabled={!layakList.length || !!bulk}
            onClick={unduhSemua}
          >
            <Download className="w-4 h-4" />
            {bulk ? `Menyiapkan ${bulk.done}/${bulk.total}…` : "Unduh Semua (ZIP)"}
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted rounded-lg p-2">
            <Lock className="w-3.5 h-3.5" />
            Unduh mulai {SERTIFIKAT_RILIS_LABEL}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada siswa yang cocok.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.profile.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{it.profile.nama_siswa || "-"}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {it.profile.kelas || "-"} • {it.profile.tempat_magang || "-"}
                </p>
                <p className="text-xs mt-1">
                  Kehadiran <span className="font-bold">{formatPersen(it.persen)}</span>
                </p>
              </div>
              <SertifikatButton
                nama={it.profile.nama_siswa || "-"}
                kelas={it.profile.kelas || "-"}
                tempat={it.profile.tempat_magang || "-"}
                persen={it.persen}
                className="shrink-0 text-right"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchableTempatSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
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
          aria-label="Cari dan pilih tempat magang"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value === "all" ? "Semua tempat" : value}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Ketik nama tempat magang…" />
          <CommandList>
            <CommandEmpty>Tempat magang tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Semua tempat"
                onSelect={() => {
                  onChange("all");
                  setOpen(false);
                }}
              >
                <Check className={value === "all" ? "opacity-100" : "opacity-0"} />
                Semua tempat
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check className={value === option ? "opacity-100" : "opacity-0"} />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
