import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getMyWaSchedule, setMyWaHariAktif } from "@/lib/wa-settings.functions";
import { CalendarDays } from "lucide-react";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function PengaturanKerjaCard() {
  const getSchedFn = useServerFn(getMyWaSchedule);
  const setSchedFn = useServerFn(setMyWaHariAktif);
  const [hariAktif, setHariAktif] = useState<number[] | null>(null);
  const [hariGlobal, setHariGlobal] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchedFn({})
      .then((r) => {
        setHariAktif(r.hari_aktif);
        setHariGlobal(r.hari_aktif_global);
      })
      .catch(() => {});
  }, [getSchedFn]);

  const eff = hariAktif ?? hariGlobal;
  const toggle = (d: number) => {
    const base = hariAktif ?? hariGlobal;
    setHariAktif(base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort());
  };

  const save = async () => {
    setSaving(true);
    try {
      await setSchedFn({ data: { hari_aktif: hariAktif } });
      toast.success("Pengaturan hari kerja disimpan");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await setSchedFn({ data: { hari_aktif: null } });
      setHariAktif(null);
      toast.success("Mengikuti pengaturan sekolah");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 border border-border space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">Pengaturan Hari Kerja</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pilih hari kerja PKL Anda. Pengingat WhatsApp jika belum absen hanya dikirim pada hari tersebut.
        {hariAktif === null && (
          <> Saat ini mengikuti pengaturan sekolah ({hariGlobal.map((d) => HARI[d]).join(", ") || "—"}).</>
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {HARI.map((h, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${eff.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
          >
            {h}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
        {hariAktif !== null && (
          <Button type="button" size="sm" variant="outline" onClick={reset} disabled={saving}>
            Ikuti Sekolah
          </Button>
        )}
      </div>
    </div>
  );
}
