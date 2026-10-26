import { useEffect, useState } from "react";
import { Award, Eye, Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  buatSertifikat,
  unduhSertifikat,
  SERTIFIKAT_MIN_PERSEN,
  SERTIFIKAT_RILIS_LABEL,
  sertifikatSudahRilis,
} from "@/lib/sertifikat";

export function SertifikatButton({
  nama,
  kelas,
  persen,
  tempat,
  className,
}: {
  nama: string;
  kelas: string;
  persen: number;
  tempat?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const layak = persen >= SERTIFIKAT_MIN_PERSEN;
  const rilis = sertifikatSudahRilis();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (!layak) {
    return (
      <div className={className}>
        <p className="text-[11px] text-muted-foreground">
          Sertifikat penghargaan terbit jika kehadiran ≥ {SERTIFIKAT_MIN_PERSEN}%.
        </p>
      </div>
    );
  }

  const bukaPratinjau = async () => {
    setBusy(true);
    setOpen(true);
    try {
      const blob = await buatSertifikat({ nama, kelas, persen, tempat }, { watermark: true });
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e: any) {
      toast.error("Gagal membuat pratinjau", { description: e?.message ?? String(e) });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button type="button" size="sm" className="gap-2" disabled={busy} onClick={bukaPratinjau}>
        <Eye className="w-4 h-4" />
        {busy && !open ? "Menyiapkan…" : "Pratinjau Sertifikat"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Award className="w-4 h-4" /> Pratinjau Sertifikat
            </DialogTitle>
            <DialogDescription>
              {nama} • {kelas} • kehadiran {persen.toFixed(1).replace(".", ",")}%
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl overflow-hidden border border-border bg-muted/40 min-h-40 flex items-center justify-center">
            {preview ? (
              <img src={preview} alt={`Pratinjau sertifikat ${nama}`} className="w-full h-auto" />
            ) : (
              <span className="text-xs text-muted-foreground py-10">Menyiapkan pratinjau…</span>
            )}
          </div>

          {rilis ? (
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await unduhSertifikat({ nama, kelas, persen, tempat });
                  toast.success("Sertifikat diunduh");
                } catch (e: any) {
                  toast.error("Gagal membuat sertifikat", { description: e?.message ?? String(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download className="w-4 h-4" />
              Unduh Sertifikat
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-3">
              <Lock className="w-4 h-4 shrink-0" />
              Sertifikat baru dapat diunduh mulai {SERTIFIKAT_RILIS_LABEL}.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
