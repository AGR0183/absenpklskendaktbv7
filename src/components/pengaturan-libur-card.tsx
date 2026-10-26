import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getMyWaSchedule, setMyWaTanggalLibur } from "@/lib/wa-settings.functions";
import { CalendarOff, Plus, X } from "lucide-react";

function fmt(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function PengaturanLiburCard() {
  const getSchedFn = useServerFn(getMyWaSchedule);
  const saveFn = useServerFn(setMyWaTanggalLibur);
  const [dates, setDates] = useState<string[]>([]);
  const [nasional, setNasional] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchedFn({})
      .then((r: any) => {
        setDates(r.tanggal_libur ?? []);
        setNasional(r.libur_nasional ?? []);
      })
      .catch(() => {});
  }, [getSchedFn]);

  const add = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      toast.error("Pilih tanggal terlebih dahulu");
      return;
    }
    if (dates.includes(input)) return;
    setDates([...dates, input].sort());
    setInput("");
  };

  const save = async (next?: string[]) => {
    const payload = next ?? dates;
    setSaving(true);
    try {
      await saveFn({ data: { tanggal_libur: payload } });
      toast.success("Tanggal libur disimpan");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = (d: string) => {
    const next = dates.filter((x) => x !== d);
    setDates(next);
    void save(next);
  };

  return (
    <div className="bg-card rounded-xl p-4 border border-border space-y-3">
      <div className="flex items-center gap-2">
        <CalendarOff className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">Libur Nasional / Libur Kantor</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tambahkan tanggal libur Anda. Pada tanggal tersebut pengingat WhatsApp "belum absen" tidak dikirim.
      </p>

      <div className="flex gap-2">
        <Input type="date" value={input} onChange={(e) => setInput(e.target.value)} className="h-9 text-sm" />
        <Button type="button" size="sm" variant="outline" onClick={add} className="shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {dates.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Belum ada tanggal libur.</p>
      ) : (
        <ul className="space-y-1">
          {dates.map((d) => (
            <li key={d} className="flex items-center justify-between gap-2 bg-muted/50 rounded-md px-2 py-1.5">
              <span className="text-xs">{fmt(d)}</span>
              <button type="button" onClick={() => remove(d)} className="text-destructive" aria-label={`Hapus ${d}`}>
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" size="sm" onClick={() => save()} disabled={saving} className="w-full">
        {saving ? "Menyimpan…" : "Simpan Tanggal Libur"}
      </Button>

      {nasional.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Libur nasional bawaan sistem: {nasional.map((d) => fmt(d)).join("; ")}.
        </p>
      )}
    </div>
  );
}
