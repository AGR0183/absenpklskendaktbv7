import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import JSZip from "jszip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Images, FileSpreadsheet } from "lucide-react";
import { exportAllData, listAllPhotos, deleteAllPhotos } from "@/lib/backup.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function BackupCard() {
  const callExport = useServerFn(exportAllData);
  const callPhotos = useServerFn(listAllPhotos);
  const callDeletePhotos = useServerFn(deleteAllPhotos);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const handleData = async () => {
    setBusy("data");
    try {
      const res = await callExport({});
      saveBlob(new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" }), `data-absen-${today}.csv`);
      toast.success(`Data diunduh (${res.total} baris)`);
    } catch (e: any) {
      toast.error("Gagal mengunduh data", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handlePhotos = async () => {
    setBusy("foto");
    setProgress("Menyiapkan daftar foto…");
    try {
      const items = await callPhotos({});
      if (!items.length) {
        toast.info("Tidak ada foto absen tersimpan");
        return;
      }
      const zip = new JSZip();
      let done = 0;
      for (let i = 0; i < items.length; i += 5) {
        const chunk = items.slice(i, i + 5);
        await Promise.all(
          chunk.map(async (it) => {
            try {
              const r = await fetch(it.url);
              if (r.ok) zip.file(it.name, await r.blob());
            } catch {
              /* lewati foto gagal */
            }
            done++;
          }),
        );
        setProgress(`Mengunduh foto ${done}/${items.length}…`);
      }
      setProgress("Membuat file ZIP…");
      const blob = await zip.generateAsync({ type: "blob" });
      saveBlob(blob, `foto-absen-${today}.zip`);
      toast.success(`${items.length} foto diunduh`);
    } catch (e: any) {
      toast.error("Gagal mengunduh foto", { description: e?.message });
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const handleDelete = async () => {
    setBusy("hapus");
    try {
      const res = await callDeletePhotos({});
      toast.success(`${res.removed} foto absen dihapus`);
    } catch (e: any) {
      toast.error("Gagal menghapus foto", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-4 h-4" />
        <h2 className="font-bold text-sm">Cadangkan &amp; Bersihkan Data</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Unduh seluruh data absen (CSV) dan seluruh foto absen (ZIP), atau hapus semua foto absen dari penyimpanan.
      </p>
      <div className="grid gap-2">
        <Button type="button" size="sm" disabled={!!busy} onClick={handleData} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          {busy === "data" ? "Menyiapkan…" : "Download Semua Data (CSV)"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!!busy} onClick={handlePhotos} className="gap-2">
          <Images className="w-4 h-4" />
          {busy === "foto" ? progress || "Menyiapkan…" : "Download Semua Foto (ZIP)"}
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={!!busy} onClick={() => setConfirmDel(true)} className="gap-2">
          <Trash2 className="w-4 h-4" />
          {busy === "hapus" ? "Menghapus…" : "Hapus Semua Foto Absen"}
        </Button>
      </div>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus semua foto absen?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh foto absen akan dihapus permanen dari penyimpanan. Data absen (tanggal, jam, lokasi) tetap tersimpan.
              Sebaiknya unduh foto terlebih dahulu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Ya, hapus semua</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
