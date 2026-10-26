import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyWaSchedule } from "@/lib/wa-settings.functions";
import { makeIsLibur } from "@/lib/libur";
import { hitungKehadiran } from "@/lib/kehadiran";
import { SertifikatButton } from "@/components/sertifikat-button";
import { Award, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sertifikat")({
  component: SertifikatPage,
});

type Row = {
  id: string;
  jenis: "masuk" | "pulang" | "izin" | "sakit";
  tanggal: string;
  waktu: string;
};

function SertifikatPage() {
  const { user, profile } = useAuth();
  const fetchSchedule = useServerFn(getMyWaSchedule);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sched, setSched] = useState<{
    hari_aktif: number[] | null;
    hari_aktif_global: number[];
    tanggal_libur: string[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id, jenis, tanggal, waktu")
        .eq("user_id", user.id)
        .order("waktu", { ascending: false });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchSchedule({})
      .then((s: any) => setSched(s))
      .catch(() => setSched(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isLibur = useMemo(
    () =>
      makeIsLibur(
        { hari_aktif: sched?.hari_aktif ?? null, tanggal_libur: sched?.tanggal_libur ?? [] },
        sched?.hari_aktif_global ?? [1, 2, 3, 4, 5, 6],
      ),
    [sched],
  );

  const { hadir, persen } = useMemo(() => hitungKehadiran(rows, isLibur), [rows, isLibur]);

  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-extrabold">Sertifikat Absensi</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted-foreground">Nama Siswa</p>
            <p className="text-base font-semibold">{profile?.nama_siswa || "-"}</p>
            <p className="text-sm text-muted-foreground mt-2">Kelas</p>
            <p className="text-base font-semibold">{profile?.kelas || "-"}</p>
            <p className="text-sm text-muted-foreground mt-2">Total Kehadiran</p>
            <p className="text-base font-semibold">
              {hadir} hari ({persen.toFixed(1).replace(".", ",")}%)
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Sertifikat penghargaan absensi diterbitkan jika persentase kehadiran siswa
              lebih dari atau sama dengan 95%.
            </p>
          </div>

          <SertifikatButton
            nama={profile?.nama_siswa || "Siswa"}
            kelas={profile?.kelas || "-"}
            tempat={(profile as any)?.tempat_magang || "-"}
            persen={persen}
          />
        </div>
      )}
    </div>
  );
}
