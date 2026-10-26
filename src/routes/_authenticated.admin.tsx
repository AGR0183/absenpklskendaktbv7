import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createSiswa, listSiswa, toggleSiswaStatus, importSiswaCsv, deleteSiswa, deleteAllSiswa, setAllSiswaStatus, listStaff, deleteStaff, deleteAllStaff } from "@/lib/siswa.functions";
import { runWaTest } from "@/lib/wa-test.functions";
import { Eye, EyeOff, Upload, UserPlus, Power, Download, Trash2, AlertTriangle, Send, LogOut, ClipboardList, KeyRound, Settings2, Users, UserX, ArrowUp, ChevronDown, DatabaseBackup } from "lucide-react";
import { WaSettingsCard } from "@/components/admin/wa-settings-card";
import { PinListCard } from "@/components/admin/pin-list-card";
import { BelumAbsenCard } from "@/components/admin/belum-absen-card";
import { BackupCard } from "@/components/admin/backup-card";
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


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — SIAP PKL" },
      { name: "description", content: "Kelola akun, absensi, pengingat, PIN, dan cadangan data SIAP PKL." },
      { property: "og:title", content: "Dashboard Admin — SIAP PKL" },
      { property: "og:description", content: "Kelola akun, absensi, pengingat, PIN, dan cadangan data SIAP PKL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Siswa = {
  id: string;
  user_id: string | null;
  username: string;
  pin: string;
  nama_lengkap: string;
  nisn: string | null;
  kelas: string | null;
  tempat_pkl: string | null;
  status_akun: "aktif" | "nonaktif";
};

function AdminPage() {
  const { roles, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const fetchList = useServerFn(listSiswa);
  const callCreate = useServerFn(createSiswa);
  const callToggle = useServerFn(toggleSiswaStatus);
  const callImport = useServerFn(importSiswaCsv);
  const callDelete = useServerFn(deleteSiswa);
  const callDeleteAll = useServerFn(deleteAllSiswa);
  const callSetAllStatus = useServerFn(setAllSiswaStatus);
  const callWaTest = useServerFn(runWaTest);
  const fetchStaff = useServerFn(listStaff);
  const callDeleteStaff = useServerFn(deleteStaff);
  const callDeleteAllStaff = useServerFn(deleteAllStaff);

  const [rows, setRows] = useState<Siswa[]>([]);
  const [staff, setStaff] = useState<{ user_id: string; nama: string; no_hp: string | null; roles: string[]; is_admin: boolean; is_guru: boolean }[]>([]);
  const [staffDeleteTarget, setStaffDeleteTarget] = useState<{ user_id: string; nama: string } | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    pin: "1234", nama_lengkap: "", nisn: "", kelas: "", tempat_pkl: "",
    no_hp_siswa: "", no_hp_ortu: "", no_hp_guru: "", no_hp_dudi: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<Siswa | null>(null);
  const [staffForm, setStaffForm] = useState<{ role: "guru" | "admin"; nama_lengkap: string; pin: string; no_hp: string }>({
    role: "guru", nama_lengkap: "", pin: "1234", no_hp: "",
  });
  const [busyStaff, setBusyStaff] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openDeleteAllDialog, setOpenDeleteAllDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busyAll, setBusyAll] = useState(false);
const [openDisableAllDialog, setOpenDisableAllDialog] = useState(false);
  const [busyDisableAll, setBusyDisableAll] = useState(false);
  const [openEnableAllDialog, setOpenEnableAllDialog] = useState(false);
  const [busyEnableAll, setBusyEnableAll] = useState(false);
  const [waDate, setWaDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [waDryRun, setWaDryRun] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waStages, setWaStages] = useState<Record<"siswa" | "ortu" | "dudi" | "guru", boolean>>({
    siswa: true, ortu: true, dudi: true, guru: true,
  });
  const [waScope, setWaScope] = useState<"all" | "selected">("all");
  const [waSelected, setWaSelected] = useState<Record<string, boolean>>({});
  const [waSearch, setWaSearch] = useState("");
  const [waResult, setWaResult] = useState<null | {
    tanggal: string;
    dryRun: boolean;
    totalBelumAbsen: number;
    stages: { tahap: string; total: number; sent: number; skipped: number; failed: number; errors?: string[] }[];
  }>(null);
  const [activeMenu, setActiveMenu] = useState("sec-daftar-siswa");
  const isStaff = roles.includes("admin") || roles.includes("guru");
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    const sectionIds = [
      "sec-tambah-siswa", "sec-staff", "sec-import", "sec-daftar-staff",
      "sec-daftar-siswa", "sec-belum-absen", "sec-wa-settings", "sec-wa-test",
      "sec-pin", "sec-backup",
    ];
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
  }, [isAdmin]);
  const handleWaTest = async () => {
    const stagesArr = (Object.keys(waStages) as Array<"siswa" | "ortu" | "dudi" | "guru">).filter((k) => waStages[k]);
    if (stagesArr.length === 0) return toast.error("Pilih minimal 1 tahap");
    let userIds: string[] | undefined;
    if (waScope === "selected") {
      userIds = rows.filter((r) => r.user_id && waSelected[r.id]).map((r) => r.user_id!) ;
      if (userIds.length === 0) return toast.error("Pilih minimal 1 siswa");
    }
    const scopeLabel = waScope === "all" ? "semua siswa" : `${userIds?.length} siswa terpilih`;
    if (!confirm(`Jalankan uji coba WA tahap [${stagesArr.join(", ")}] untuk ${scopeLabel} (${waDate})${waDryRun ? " (DRY RUN)" : ""}?`)) return;
    setWaBusy(true);
    setWaResult(null);
    try {
      const r = await callWaTest({ data: { tanggal: waDate, dryRun: waDryRun, stages: stagesArr, userIds } });
      setWaResult(r);
      toast.success(`Uji coba selesai untuk ${r.tanggal}`, {
        description: `${r.totalBelumAbsen} siswa belum absen`,
      });
    } catch (e: any) {
      toast.error("Gagal menjalankan uji coba", { description: e?.message });
    } finally {
      setWaBusy(false);
    }
  };

  const downloadTemplate = () => {
    const header = "role,pin,nama_lengkap,nisn,kelas,tempat_pkl,no_hp_siswa,no_hp_ortu,no_hp_guru,no_hp_dudi";
    const example = [
      'siswa,1234,Andi Saputra,1234567890,XII TKJ 1,PT Maju Jaya,081200000001,081200000002,081200000003,081200000004',
      'siswa,1234,Budi Santoso,1234567891,XII TKJ 1,"CV Sinar, Abadi",081200000005,081200000006,081200000007,081200000008',
      'guru,1234,Pak Hadi Pembimbing,,,,081200000010,,,',
      'admin,1234,Bu Admin Sekolah,,,,081200000011,,,',
    ].join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + example + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-siswa.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!loading && !isStaff) navigate({ to: "/beranda" });
  }, [loading, isStaff, navigate]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchList({});
      setRows((r.rows ?? []) as Siswa[]);
      if (isAdmin) {
        try {
          const s = await fetchStaff({});
          setStaff((s.rows ?? []) as any);
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      toast.error("Gagal memuat", { description: e?.message });
    }
  }, [fetchList, fetchStaff, isAdmin]);

  useEffect(() => { if (isStaff) refresh(); }, [isStaff, refresh]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{4,6}$/.test(form.pin)) {
      toast.error("PIN harus 4-6 digit angka");
      return;
    }
    setBusy(true);
    try {
      await callCreate({ data: form });
      toast.success(`Siswa ${form.nama_lengkap} ditambahkan`);
      setForm({
        pin: "1234", nama_lengkap: "", nisn: "", kelas: "", tempat_pkl: "",
        no_hp_siswa: "", no_hp_ortu: "", no_hp_guru: "", no_hp_dudi: "",
      });
      await refresh();
    } catch (e: any) {
      toast.error("Gagal menambah", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.nama_lengkap.trim()) return toast.error("Nama lengkap wajib diisi");
    if (!/^[0-9]{4,6}$/.test(staffForm.pin)) return toast.error("PIN harus 4-6 digit angka");
    setBusyStaff(true);
    try {
      await callCreate({
        data: {
          role: staffForm.role,
          pin: staffForm.pin,
          nama_lengkap: staffForm.nama_lengkap.trim(),
          nisn: "", kelas: "", tempat_pkl: "",
          no_hp_siswa: staffForm.no_hp.trim(),
          no_hp_ortu: "", no_hp_guru: "", no_hp_dudi: "",
        },
      });
      toast.success(`${staffForm.role === "admin" ? "Admin" : "Guru"} ${staffForm.nama_lengkap} ditambahkan`);
      setStaffForm({ role: staffForm.role, nama_lengkap: "", pin: "1234", no_hp: "" });
      await refresh();
    } catch (err: any) {
      toast.error("Gagal menambah", { description: err?.message });
    } finally {
      setBusyStaff(false);
    }
  };

  const handleToggle = async (id: string, current: "aktif" | "nonaktif") => {
    const next = current === "aktif" ? "nonaktif" : "aktif";
    if (!confirm(`Ubah status menjadi ${next}?`)) return;
    try {
      await callToggle({ data: { id, status: next } });
      toast.success(`Status menjadi ${next}`);
      await refresh();
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    }
  };

  const handleDelete = (s: Siswa) => {
    setDeleteTarget(s);
    setOpenDeleteDialog(true);
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await callDelete({ data: { id: deleteTarget.id, user_id: deleteTarget.user_id ?? undefined } });
      toast.success("Siswa dihapus");
      await refresh();
    } catch (e: any) {
      toast.error("Gagal menghapus", { description: e?.message });
    } finally {
      setOpenDeleteDialog(false);
      setDeleteTarget(null);
    }
  };

const doDisableAll = async () => {
    setBusyDisableAll(true);
    try {
      const r = await callSetAllStatus({ data: { status: "nonaktif", confirm: "KONFIRMASI" } });
      toast.success(`${r.updated} siswa dinonaktifkan`, { description: `${r.banned} akun login diblokir sementara.` });
      await refresh();
    } catch (e: any) {
      toast.error("Gagal menonaktifkan semua", { description: e?.message });
    } finally {
      setBusyDisableAll(false);
      setOpenDisableAllDialog(false);
    }
  };

  const doEnableAll = async () => {
    setBusyEnableAll(true);
    try {
      const r = await callSetAllStatus({ data: { status: "aktif", confirm: "KONFIRMASI" } });
      toast.success(`${r.updated} siswa diaktifkan`, { description: `${r.banned} akun login diaktifkan kembali.` });
      await refresh();
    } catch (e: any) {
      toast.error("Gagal mengaktifkan semua", { description: e?.message });
    } finally {
      setBusyEnableAll(false);
      setOpenEnableAllDialog(false);
    }
  };

  const doDeleteAll = async () => {
    setBusyAll(true);
    try {
      const r = await callDeleteAll({ data: { confirm: "HAPUS SEMUA" } });
      toast.success(`${r.deleted}/${r.total} siswa dihapus`);
      if (r.errors?.length) toast.error("Beberapa gagal", { description: r.errors.slice(0, 3).join("\n") });
      await refresh();
    } catch (e: any) {
      toast.error("Gagal menghapus semua", { description: e?.message });
    } finally {
      setBusyAll(false);
      setOpenDeleteAllDialog(false);
      setConfirmText("");
    }
  };

  const handleCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast.error("CSV kosong");
    const header = lines[0].toLowerCase().split(",").map((s) => s.trim());
    const required = ["pin", "nama_lengkap"];
    const missing = required.filter((c) => !header.includes(c));
    if (missing.length) return toast.error(`Kolom hilang: ${missing.join(", ")}`);
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    const rows = lines.slice(1).map((line) => {
      const c = parseCsvLine(line);
      const roleRaw = idx.role != null ? (c[idx.role] ?? "").trim().toLowerCase() : "siswa";
      const role = (["siswa", "guru", "admin"].includes(roleRaw) ? roleRaw : "siswa") as
        | "siswa"
        | "guru"
        | "admin";
      return {
        role,
        pin: (c[idx.pin] ?? "1234").trim() || "1234",
        nama_lengkap: c[idx.nama_lengkap] ?? "",
        nisn: idx.nisn != null ? (c[idx.nisn] ?? "") : "",
        kelas: idx.kelas != null ? (c[idx.kelas] ?? "") : "",
        tempat_pkl: idx.tempat_pkl != null ? (c[idx.tempat_pkl] ?? "") : "",
        no_hp_siswa: idx.no_hp_siswa != null ? (c[idx.no_hp_siswa] ?? "") : "",
        no_hp_ortu: idx.no_hp_ortu != null ? (c[idx.no_hp_ortu] ?? "") : "",
        no_hp_guru: idx.no_hp_guru != null ? (c[idx.no_hp_guru] ?? "") : "",
        no_hp_dudi: idx.no_hp_dudi != null ? (c[idx.no_hp_dudi] ?? "") : "",
      };
    });
    setBusy(true);
    try {
      const r = await callImport({ data: { rows } });
      const updated = r.results.filter((x) => x.ok && (x as any).updated).length;
      const ok = r.results.filter((x) => x.ok).length - updated;
      const skipped = r.results.filter((x) => !x.ok && (x as any).skipped).length;
      const fail = r.results.length - ok - updated - skipped;
      toast.success(`Import selesai: ${ok} baru, ${updated} diperbarui, ${skipped} dilewati, ${fail} gagal`);
      if (fail > 0) {
        const errs = r.results.filter((x) => !x.ok && !(x as any).skipped).slice(0, 5).map((x) => `${x.label}: ${x.error}`).join("\n");
        toast.error("Beberapa gagal", { description: errs });
      }
      await refresh();
    } catch (e: any) {
      toast.error("Gagal import", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const filtered = rows.filter((r) => {
    const t = filter.trim().toLowerCase();
    if (!t) return true;
    return [r.username, r.nama_lengkap, r.nisn, r.kelas, r.tempat_pkl].some((v) => (v ?? "").toLowerCase().includes(t));
  });

  return (
    <div id="admin-top" className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:items-start lg:gap-6 lg:px-6">
       <AdminMenu isAdmin={isAdmin} activeMenu={activeMenu} onMenuChange={setActiveMenu} />
      <main className="min-w-0 w-full max-w-2xl mx-auto lg:mx-0 lg:flex-1">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h1 className="text-xl font-extrabold mb-1">Dashboard Admin</h1>
          <p className="text-xs text-muted-foreground">Kelola akun siswa PKL</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs text-destructive border-destructive/40"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="w-3 h-3" /> Keluar
        </Button>
      </div>

      {/* Tambah satu siswa */}
      <form id="sec-tambah-siswa" onSubmit={handleCreate} className="bg-card rounded-2xl p-4 border border-border mb-4 space-y-2 scroll-mt-4">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-4 h-4" /> <h2 className="font-bold text-sm">Tambah Siswa</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nama Lengkap" value={form.nama_lengkap} onChange={(v) => setForm({ ...form, nama_lengkap: v })} required wide />
          <Field label="PIN (4-6 digit)" value={form.pin} onChange={(v) => setForm({ ...form, pin: v.replace(/\D/g, "").slice(0, 6) })} required minLength={4} />
          <Field label="NISN" value={form.nisn} onChange={(v) => setForm({ ...form, nisn: v })} />
          <Field label="Kelas" value={form.kelas} onChange={(v) => setForm({ ...form, kelas: v })} />
          <Field label="Tempat PKL" value={form.tempat_pkl} onChange={(v) => setForm({ ...form, tempat_pkl: v })} wide />
          <Field label="No. HP Siswa" value={form.no_hp_siswa} onChange={(v) => setForm({ ...form, no_hp_siswa: v })} />
          <Field label="No. HP Orang Tua" value={form.no_hp_ortu} onChange={(v) => setForm({ ...form, no_hp_ortu: v })} />
          <Field label="No. HP Guru Pembimbing" value={form.no_hp_guru} onChange={(v) => setForm({ ...form, no_hp_guru: v })} />
          <Field label="No. HP Pembimbing DUDI" value={form.no_hp_dudi} onChange={(v) => setForm({ ...form, no_hp_dudi: v })} />
        </div>
        <Button type="submit" disabled={busy} className="w-full mt-2" size="sm">
          {busy ? "Memproses…" : "Simpan Siswa"}
        </Button>
        <BackToMenu />
      </form>

      {/* Import CSV */}
      {isAdmin && (
        <form id="sec-staff" onSubmit={handleCreateStaff} className="bg-card rounded-2xl p-4 border border-border mb-4 space-y-2 scroll-mt-4">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4" /> <h2 className="font-bold text-sm">Tambah Guru &amp; Admin</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Akun guru/admin login memakai PIN. Guru hanya bisa melihat rekap absen siswa.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px]">Peran</Label>
              <select
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as "guru" | "admin" })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="guru">Guru Pembimbing</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Field label="Nama Lengkap" value={staffForm.nama_lengkap} onChange={(v) => setStaffForm({ ...staffForm, nama_lengkap: v })} required wide />
            <Field label="PIN (4-6 digit)" value={staffForm.pin} onChange={(v) => setStaffForm({ ...staffForm, pin: v.replace(/\D/g, "").slice(0, 6) })} required minLength={4} />
            <Field label="No. HP" value={staffForm.no_hp} onChange={(v) => setStaffForm({ ...staffForm, no_hp: v })} />
          </div>
          <Button type="submit" disabled={busyStaff} className="w-full mt-2" size="sm">
            {busyStaff ? "Memproses…" : `Simpan ${staffForm.role === "admin" ? "Admin" : "Guru"}`}
          </Button>
          <BackToMenu />
        </form>
      )}

      {/* Import CSV */}
      <div id="sec-import" className="bg-card rounded-2xl p-4 border border-border mb-4 scroll-mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-4 h-4" /> <h2 className="font-bold text-sm">Import CSV</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mb-1">
          Kolom: <code>role,pin,nama_lengkap,nisn,kelas,tempat_pkl,no_hp_siswa,no_hp_ortu,no_hp_guru,no_hp_dudi</code>
        </p>
        <p className="text-[11px] text-muted-foreground mb-2">
          <b>role</b>: <code>siswa</code> (default), <code>guru</code>, atau <code>admin</code>. Akun guru/admin hanya bisa di-import oleh admin.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-1 h-8 text-xs bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/90">
            <Download className="w-3 h-3" /> Download Template CSV
          </Button>
          <Button asChild type="button" variant="outline" size="sm" disabled={busy} className="gap-1 h-8 text-xs bg-success text-success-foreground border-transparent hover:bg-success/90">
            <label className="cursor-pointer">
              <Upload className="w-3 h-3" /> Pilih File CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCSV(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </Button>
        </div>
        <BackToMenu />
      </div>

      {/* Uji coba pengingat WA */}
      {isAdmin && (
        <div id="sec-wa-test" className="bg-card rounded-2xl p-4 border border-border mb-4 scroll-mt-4">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-4 h-4" />
            <h2 className="font-bold text-sm">Uji Coba Pengingat WA</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Menjalankan 4 tahap pengingat (siswa, ortu, DUDI, ringkasan guru) untuk tanggal tertentu sebelum jadwal aktif.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <Label className="text-[10px]">Tanggal uji coba</Label>
              <Input type="date" value={waDate} onChange={(e) => setWaDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <label className="flex items-end gap-2 text-[11px] pb-1">
              <input type="checkbox" checked={waDryRun} onChange={(e) => setWaDryRun(e.target.checked)} />
              <span>Dry run (tidak benar-benar kirim WA)</span>
            </label>
          </div>
          <div className="mb-2">
            <Label className="text-[10px]">Tahap pengingat</Label>
            <div className="flex flex-wrap gap-3 mt-1">
              {(["siswa", "ortu", "dudi", "guru"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={waStages[k]}
                    onChange={(e) => setWaStages({ ...waStages, [k]: e.target.checked })}
                  />
                  <span className="capitalize">{k === "guru" ? "guru (ringkasan)" : k}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <Label className="text-[10px]">Penerima</Label>
            <div className="flex gap-3 mt-1 text-[11px]">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="wa-scope"
                  checked={waScope === "all"}
                  onChange={() => setWaScope("all")}
                />
                <span>Semua siswa belum absen</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="wa-scope"
                  checked={waScope === "selected"}
                  onChange={() => setWaScope("selected")}
                />
                <span>Pilih siswa tertentu</span>
              </label>
            </div>
          </div>
          {waScope === "selected" && (
            <div className="mb-2 border border-border rounded-lg p-2 bg-background">
              <Input
                placeholder="Cari nama/username/kelas…"
                value={waSearch}
                onChange={(e) => setWaSearch(e.target.value)}
                className="h-7 text-xs mb-2"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>{Object.values(waSelected).filter(Boolean).length} dipilih</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      const next: Record<string, boolean> = { ...waSelected };
                      for (const r of rows) {
                        const t = waSearch.trim().toLowerCase();
                        const match = !t || [r.username, r.nama_lengkap, r.kelas].some((v) => (v ?? "").toLowerCase().includes(t));
                        if (match && r.user_id) next[r.id] = true;
                      }
                      setWaSelected(next);
                    }}
                  >
                    pilih hasil
                  </button>
                  <button type="button" className="underline" onClick={() => setWaSelected({})}>
                    bersihkan
                  </button>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {rows
                  .filter((r) => {
                    const t = waSearch.trim().toLowerCase();
                    if (!t) return true;
                    return [r.username, r.nama_lengkap, r.kelas].some((v) => (v ?? "").toLowerCase().includes(t));
                  })
                  .map((r) => (
                    <label key={r.id} className={`flex items-center gap-2 text-[11px] px-1 py-0.5 rounded ${!r.user_id ? "opacity-50" : ""}`}>
                      <input
                        type="checkbox"
                        disabled={!r.user_id}
                        checked={!!waSelected[r.id]}
                        onChange={(e) => setWaSelected({ ...waSelected, [r.id]: e.target.checked })}
                      />
                      <span className="truncate">
                        {r.nama_lengkap} <span className="text-muted-foreground">@{r.username} • {r.kelas || "-"}</span>
                        {!r.user_id && <span className="text-destructive"> (belum login)</span>}
                      </span>
                    </label>
                  ))}
                {rows.length === 0 && <p className="text-[11px] text-muted-foreground">Belum ada siswa.</p>}
              </div>
            </div>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleWaTest}
            disabled={waBusy}
            className="w-full gap-1 h-8 text-xs"
          >
            <Send className="w-3 h-3" />
            {waBusy ? "Mengirim…" : `Kirim Uji Coba WA${waDryRun ? " (Dry Run)" : ""}`}
          </Button>
          {waResult && (
            <div className="mt-3 text-[11px] bg-muted/40 rounded-lg p-2 space-y-1">
              <p>
                Tanggal <b>{waResult.tanggal}</b> • {waResult.totalBelumAbsen} siswa belum absen
                {waResult.dryRun ? " • DRY RUN" : ""}
              </p>
              {waResult.stages.map((s) => (
                <div key={s.tahap}>
                  <p>
                    <b className="uppercase">{s.tahap}</b>: terkirim {s.sent}, dilewati {s.skipped}, gagal {s.failed}
                  </p>
                  {s.errors && s.errors.length > 0 && (
                    <ul className="ml-4 text-destructive list-disc">
                      {s.errors.map((e, i) => (<li key={i} className="break-all">{e}</li>))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          <BackToMenu />
        </div>
      )}

      {isAdmin && <div id="sec-belum-absen" className="scroll-mt-4"><BelumAbsenCard /><BackToMenu className="mb-4" /></div>}
      {isAdmin && <div id="sec-wa-settings" className="scroll-mt-4"><WaSettingsCard siswa={rows} /><BackToMenu className="mb-4" /></div>}
      {isAdmin && <div id="sec-pin" className="scroll-mt-4"><PinListCard /><BackToMenu className="mb-4" /></div>}
      {isAdmin && <div id="sec-backup" className="scroll-mt-4"><BackupCard /><BackToMenu className="mb-4" /></div>}

      {isAdmin && (
        <div id="sec-daftar-staff" className="bg-card rounded-2xl p-4 border border-border mb-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-bold text-sm">Daftar Admin & Guru ({staff.length})</h2>
            {staff.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 gap-1 text-[10px]"
                onClick={async () => {
                  if (!confirm("Hapus SEMUA akun admin & guru (kecuali akun Anda)? Tindakan ini permanen.")) return;
                  try {
                    const r = await callDeleteAllStaff({ data: { confirm: "HAPUS SEMUA" } });
                    toast.success(`${r.deleted} akun staf dihapus`);
                    refresh();
                  } catch (e: any) {
                    toast.error("Gagal menghapus", { description: e?.message });
                  }
                }}
              >
                <AlertTriangle className="w-3 h-3" /> Hapus Semua
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Hapus akun admin/guru. Tindakan ini permanen.
          </p>
          <div className="space-y-2">
            {staff.length === 0 && <p className="text-xs text-muted-foreground">Belum ada akun staf.</p>}
            {staff.map((s) => (
              <div key={s.user_id} className="rounded-xl p-3 border border-border bg-background flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{s.nama}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.roles.join(", ")} {s.no_hp ? `• ${s.no_hp}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => setStaffDeleteTarget({ user_id: s.user_id, nama: s.nama })}
                >
                  <Trash2 className="w-3 h-3" /> Hapus
                </Button>
              </div>
            ))}
          </div>
          <BackToMenu />
        </div>
      )}

      <div id="sec-daftar-siswa" className="bg-card rounded-2xl p-4 border border-border scroll-mt-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-bold text-sm">Daftar Siswa ({rows.length})</h2>

{isAdmin && rows.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-[10px] bg-success text-success-foreground hover:bg-success/90"
                onClick={() => setOpenEnableAllDialog(true)}
              >
                <Power className="w-3 h-3" /> Aktifkan Semua
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-[10px] bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={() => setOpenDisableAllDialog(true)}
              >
                <UserX className="w-3 h-3" /> Nonaktifkan Semua
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 gap-1 text-[10px]"
                onClick={() => { setConfirmText(""); setOpenDeleteAllDialog(true); }}
              >
                <AlertTriangle className="w-3 h-3" /> Hapus Semua Siswa
              </Button>
            </div>
          )}
        </div>
        <Input placeholder="Cari username/nama/kelas…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-3" />
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground">Belum ada data.</p>}
          {filtered.map((s) => (
            <div key={s.id} className={`rounded-xl p-3 border ${s.status_akun === "nonaktif" ? "bg-muted/40 border-muted" : "bg-background border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {s.user_id ? (
                    <Link
                      to="/rekap/$userId"
                      params={{ userId: s.user_id }}
                      className="font-bold text-sm truncate hover:underline block"
                    >
                      {s.nama_lengkap}
                    </Link>
                  ) : (
                    <p className="font-bold text-sm truncate">{s.nama_lengkap}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground truncate">
                    @{s.username} • {s.kelas || "-"} • {s.tempat_pkl || "-"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">NISN: {s.nisn || "-"}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">PIN:</span>
                    <code className="text-[11px] bg-muted px-1 rounded">
                      {show[s.id] ? s.pin : "••••"}
                    </code>
                    <button type="button" onClick={() => setShow({ ...show, [s.id]: !show[s.id] })} className="text-muted-foreground">
                      {show[s.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.status_akun === "aktif" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {s.status_akun}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(s.id, s.status_akun)}
                    className={`h-7 text-[10px] gap-1 border-transparent ${s.status_akun === "aktif" ? "bg-warning text-warning-foreground hover:bg-warning/90" : "bg-success text-success-foreground hover:bg-success/90"}`}
                  >
                    <Power className="w-3 h-3" />
                    {s.status_akun === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(s)}
                    className="h-7 text-[10px] gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Hapus
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <BackToMenu />
      </div>

      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data siswa?</AlertDialogTitle>
            <AlertDialogDescription>
              Siswa <strong>{deleteTarget?.nama_lengkap}</strong> (@{deleteTarget?.username}) akan dihapus secara permanen.
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

<AlertDialog open={openEnableAllDialog} onOpenChange={setOpenEnableAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5" /> Aktifkan SEMUA siswa?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Semua <strong>{rows.length} akun siswa</strong> yang nonaktif akan berstatus aktif kembali dan bisa login.
                Data absensi tidak berubah.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyEnableAll}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doEnableAll(); }}
              disabled={busyEnableAll}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {busyEnableAll ? "Memproses…" : "Ya, Aktifkan Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={openDisableAllDialog} onOpenChange={setOpenDisableAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5" /> Nonaktifkan SEMUA siswa?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Semua <strong>{rows.length} akun siswa</strong> akan berstatus nonaktif dan tidak bisa login.
                Data absensi tidak dihapus dan akun dapat diaktifkan kembali satu per satu.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyDisableAll}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDisableAll(); }}
              disabled={busyDisableAll}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {busyDisableAll ? "Memproses…" : "Ya, Nonaktifkan Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={openDeleteAllDialog} onOpenChange={setOpenDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Hapus SEMUA data siswa?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Tindakan ini akan menghapus <strong>{rows.length} akun siswa</strong>,
                seluruh data absensi, profil, dan tidak dapat dibatalkan.
              </span>
              <span className="block">
                Ketik <code className="px-1 bg-muted rounded">HAPUS SEMUA</code> untuk melanjutkan.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="HAPUS SEMUA"
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAll}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDeleteAll(); }}
              disabled={confirmText !== "HAPUS SEMUA" || busyAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busyAll ? "Menghapus…" : "Ya, Hapus Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!staffDeleteTarget} onOpenChange={(o) => { if (!o) setStaffDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun staf?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <strong>{staffDeleteTarget?.nama}</strong> akan dihapus permanen beserta seluruh data terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!staffDeleteTarget) return;
                try {
                  await callDeleteStaff({ data: { user_id: staffDeleteTarget.user_id } });
                  toast.success("Akun dihapus");
                  setStaffDeleteTarget(null);
                  await refresh();
                } catch (err: any) {
                  toast.error("Gagal menghapus", { description: err?.message });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, required, minLength, wide }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; minLength?: number; wide?: boolean }) {
  return (
    <div className={`space-y-1 ${wide ? "col-span-2" : ""}`}>
      <Label className="text-[10px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} minLength={minLength} className="h-8 text-xs" />
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ""; }
      else if (ch === '"') { inQ = true; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
type AdminMenuProps = {
  isAdmin: boolean;
  activeMenu: string;
  onMenuChange: (targetId: string) => void;
};

function scrollToAdminSection(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function AdminMenu({ isAdmin, activeMenu, onMenuChange }: AdminMenuProps) {
  const contents = (
    <nav aria-label="Menu Admin" className="space-y-4">
      <MenuGroup label="Data Akun">
        <AdminMenuButton icon={<UserPlus />} label="Tambah Siswa" targetId="sec-tambah-siswa" tone="primary" active={activeMenu === "sec-tambah-siswa"} onSelect={onMenuChange} />
        {isAdmin && <AdminMenuButton icon={<Users />} label="Tambah Guru & Admin" targetId="sec-staff" tone="primary" active={activeMenu === "sec-staff"} onSelect={onMenuChange} />}
        <AdminMenuButton icon={<Upload />} label="Import CSV" targetId="sec-import" tone="accent" active={activeMenu === "sec-import"} onSelect={onMenuChange} />
        {isAdmin && <AdminMenuButton icon={<Users />} label="Daftar Admin & Guru" targetId="sec-daftar-staff" tone="secondary" active={activeMenu === "sec-daftar-staff"} onSelect={onMenuChange} />}
        <AdminMenuButton icon={<ClipboardList />} label="Daftar Siswa" targetId="sec-daftar-siswa" tone="primary" active={activeMenu === "sec-daftar-siswa"} onSelect={onMenuChange} />
      </MenuGroup>
      <MenuGroup label="Absensi">
        {isAdmin && <AdminMenuButton icon={<UserX />} label="Belum Absen" targetId="sec-belum-absen" tone="destructive" active={activeMenu === "sec-belum-absen"} onSelect={onMenuChange} />}
        <Button asChild variant="ghost" className="h-9 w-full justify-start px-2 text-xs font-medium">
          <Link to="/rekap-semua"><ClipboardList /> Rekap Absen</Link>
        </Button>
      </MenuGroup>
      {isAdmin && (
        <>
          <MenuGroup label="WhatsApp">
            <AdminMenuButton icon={<Settings2 />} label="Setelan WA" targetId="sec-wa-settings" tone="secondary" active={activeMenu === "sec-wa-settings"} onSelect={onMenuChange} />
            <AdminMenuButton icon={<Send />} label="Uji Coba Pengingat" targetId="sec-wa-test" tone="secondary" active={activeMenu === "sec-wa-test"} onSelect={onMenuChange} />
          </MenuGroup>
          <MenuGroup label="Keamanan">
            <AdminMenuButton icon={<KeyRound />} label="Daftar PIN" targetId="sec-pin" tone="destructive" active={activeMenu === "sec-pin"} onSelect={onMenuChange} />
          </MenuGroup>
          <MenuGroup label="Data & Cadangan">
            <AdminMenuButton icon={<DatabaseBackup />} label="Cadangkan Data" targetId="sec-backup" tone="accent" active={activeMenu === "sec-backup"} onSelect={onMenuChange} />
          </MenuGroup>
        </>
      )}
    </nav>
  );

  return (
    <>
      <aside id="sec-menu" className="hidden w-64 shrink-0 lg:sticky lg:top-6 lg:block">
        <div className="rounded-lg border border-sidebar-border bg-sidebar p-3 shadow-sm">
          <div className="mb-4 border-b border-sidebar-border px-2 pb-3">
            <p className="text-sm font-extrabold text-sidebar-foreground">Menu Admin</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">SIAP PKL</p>
          </div>
          {contents}
        </div>
      </aside>
      <details className="group rounded-lg border border-border bg-card shadow-sm lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><Settings2 className="size-4 text-primary" /> Menu Admin</span>
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

const adminMenuToneClasses = {
  primary: "text-primary [&_svg]:text-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:[&_svg]:text-primary-foreground",
  secondary: "text-secondary [&_svg]:text-secondary data-[active=true]:bg-secondary data-[active=true]:text-secondary-foreground data-[active=true]:[&_svg]:text-secondary-foreground",
  destructive: "text-destructive [&_svg]:text-destructive data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:[&_svg]:text-destructive-foreground",
  accent: "text-accent-foreground [&_svg]:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[active=true]:[&_svg]:text-accent-foreground",
};

function AdminMenuButton({
  icon, label, targetId, tone, active, onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  targetId: string;
  tone: keyof typeof adminMenuToneClasses;
  active: boolean;
  onSelect: (targetId: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-active={active}
      aria-current={active ? "location" : undefined}
      className={`h-9 w-full justify-start px-2 text-xs font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${adminMenuToneClasses[tone]}`}
      onClick={() => {
        onSelect(targetId);
        scrollToAdminSection(targetId);
      }}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

function BackToMenu({ className = "" }: { className?: string }) {
  return (
    <div className={`pt-2 ${className}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-[11px] text-secondary hover:text-secondary hover:bg-secondary/10"
        onClick={() => scrollToAdminSection("admin-top")}
      >
        <ArrowUp className="w-3 h-3" /> Kembali ke menu
      </Button>
    </div>
  );
}
