import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTanggal, formatJam } from "@/lib/format";
import { LogIn, LogOut, FileText, HeartPulse, CalendarX, MapPin } from "lucide-react";

type AttItem = {
  id?: string;
  jenis: string;
  tanggal?: string;
  waktu?: string;
  nama_lokasi?: string | null;
};

type AlpaItem = {
  tanggal: string;
  hari: number;
  keterangan: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "masuk" | "pulang" | "izin" | "sakit" | "alpa" | null;
  att: AttItem[];
  alpaItems?: AlpaItem[];
};

export function RekapDetailDialog({ open, onOpenChange, mode, att, alpaItems = [] }: Props) {
  if (!mode) return null;

  const label = mode === "alpa" ? "Alpa" : mode.charAt(0).toUpperCase() + mode.slice(1);
  const filtered = mode === "alpa" ? [] : att.filter((r) => r.jenis === mode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize flex items-center gap-2">
            {mode === "alpa" ? <CalendarX className="w-4 h-4 text-destructive" /> : jenisIcon(mode)}
            Detail {label}
          </DialogTitle>
        </DialogHeader>
        {mode === "alpa" ? (
          alpaItems.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {alpaItems.map((it) => (
                <div
                  key={it.tanggal}
                  className="flex items-center justify-between text-xs rounded-lg border border-border px-3 py-2"
                >
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
          )
        ) : filtered.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {filtered.map((r, idx) => (
              <div key={r.id ?? idx} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  {jenisIcon(r.jenis)}
                  <span className="font-bold uppercase">{r.jenis}</span>
                </div>
                <p className="text-sm font-semibold mt-0.5">{formatTanggal(r.waktu ?? r.tanggal ?? "")}</p>
                {r.waktu && <p className="text-[11px] text-muted-foreground">{formatJam(r.waktu)}</p>}
                {r.nama_lokasi && (
                  <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {r.nama_lokasi}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground text-center py-6">Tidak ada data.</p>;
}

function jenisIcon(j: string) {
  if (j === "masuk") return <LogIn className="w-3.5 h-3.5 text-success" />;
  if (j === "pulang") return <LogOut className="w-3.5 h-3.5 text-primary" />;
  if (j === "izin") return <FileText className="w-3.5 h-3.5 text-accent-foreground" />;
  return <HeartPulse className="w-3.5 h-3.5 text-destructive" />;
}

function formatHari(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
