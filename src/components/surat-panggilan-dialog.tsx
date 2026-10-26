import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/format";
import { unduhSuratPanggilan, type DataSuratPanggilan } from "@/lib/surat-panggilan";

export type SuratDialogState = (DataSuratPanggilan & { jenis: "ortu" | "dudi" }) | null;

export function SuratPanggilanDialog({ state, onOpenChange }: { state: SuratDialogState; onOpenChange: (s: SuratDialogState) => void }) {
  const [tanggalSurat, setTanggalSurat] = useState(todayISO());
  const [tanggalPanggilan, setTanggalPanggilan] = useState("");
  const [mengunduh, setMengunduh] = useState(false);

  useEffect(() => {
    if (state) {
      setTanggalSurat(todayISO());
      setTanggalPanggilan("");
    }
  }, [state]);

  const open = state !== null;
  const judul = state?.jenis === "dudi" ? "Unduh Surat Izin ke DUDI" : "Unduh Surat Panggilan Ortu";

  async function unduh() {
    if (!state) return;
    if (!tanggalPanggilan) {
      toast.error("Tanggal siswa akan dipanggil wajib diisi.");
      return;
    }
    setMengunduh(true);
    try {
      await unduhSuratPanggilan(state.jenis, state, { tanggalSurat, tanggalPanggilan });
      onOpenChange(null);
    } catch (error) {
      toast.error("Surat tidak dapat diunduh", {
        description: error instanceof Error ? error.message : "Silakan coba kembali.",
      });
    } finally {
      setMengunduh(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o ? state : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>
            Lengkapi tanggal sebelum surat diunduh dalam format .docx.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <label htmlFor="tanggal-surat-keluar" className="text-sm font-medium">
              Tanggal Surat Keluar
            </label>
            <Input
              id="tanggal-surat-keluar"
              type="date"
              value={tanggalSurat}
              onChange={(e) => setTanggalSurat(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="tanggal-panggilan" className="text-sm font-medium">
              Tanggal Siswa akan dipanggil ke sekolah <span className="text-destructive">*</span>
            </label>
            <Input
              id="tanggal-panggilan"
              type="date"
              value={tanggalPanggilan}
              onChange={(e) => setTanggalPanggilan(e.target.value)}
            />
            {state && (
              <p className="text-xs text-muted-foreground">
                Surat untuk <span className="font-medium">{state.nama}</span>
                {state.kelas ? ` — ${state.kelas}` : ""}
                {state.tempatMagang ? ` — ${state.tempatMagang}` : ""}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(null)} disabled={mengunduh}>
            Batal
          </Button>
          <Button type="button" onClick={unduh} disabled={mengunduh || !tanggalPanggilan}>
            {mengunduh ? "Mengunduh…" : "Unduh .docx"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
