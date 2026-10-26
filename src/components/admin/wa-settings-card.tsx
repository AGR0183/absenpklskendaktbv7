import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getWaSettings, updateWaSettings, listWaOverrides, setWaOverride } from "@/lib/wa-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Clock, Save } from "lucide-react";

type Settings = {
  jam_siswa: string; jam_pulang: string; jam_ortu: string; jam_dudi: string; jam_guru: string;
  aktif_siswa: boolean; aktif_pulang: boolean; aktif_ortu: boolean; aktif_dudi: boolean; aktif_guru: boolean;
  template_siswa: string; template_pulang: string; template_ortu: string; template_dudi: string; template_guru: string;
  hari_aktif: number[];
  fonnte_token: string | null;
  fonnte_sender: string | null;
  jeda_menit: number;
};

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function WaSettingsCard({ siswa }: { siswa: { id: string; user_id: string | null; nama_lengkap: string; kelas: string | null }[] }) {
  const getFn = useServerFn(getWaSettings);
  const updFn = useServerFn(updateWaSettings);
  const listOv = useServerFn(listWaOverrides);
  const setOv = useServerFn(setWaOverride);

  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"global" | "override">("global");
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    getFn({}).then((r) => setS(r.settings as Settings | null)).catch(() => {});
    listOv({}).then((r) => {
      const m: Record<string, any> = {};
      for (const o of r.rows) m[o.siswa_user_id] = o;
      setOverrides(m);
    }).catch(() => {});
  }, [getFn, listOv]);

  if (!s) return <div className="bg-card rounded-2xl p-4 border border-border text-xs">Memuat pengaturan WA…</div>;

  const save = async () => {
    setBusy(true);
    try {
      await updFn({ data: s });
      toast.success("Pengaturan WA disimpan");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleHari = (d: number) => {
    setS({ ...s, hari_aktif: s.hari_aktif.includes(d) ? s.hari_aktif.filter((x) => x !== d) : [...s.hari_aktif, d].sort() });
  };

  const saveOverride = async (user_id: string, patch: Partial<any>) => {
    const cur = overrides[user_id] ?? { siswa_user_id: user_id, disable_all: false, skip_siswa: false, skip_pulang: false, skip_ortu: false, skip_dudi: false, skip_guru: false };
    const next = { ...cur, ...patch };
    setOverrides({ ...overrides, [user_id]: next });
    try { await setOv({ data: { siswa_user_id: user_id, ...patch } }); }
    catch (e: any) { toast.error("Gagal", { description: e?.message }); }
  };

  const filtered = siswa.filter((r) => {
    if (!r.user_id) return false;
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return [r.nama_lengkap, r.kelas ?? ""].some((v) => v.toLowerCase().includes(t));
  });

  return (
    <div className="bg-card rounded-2xl p-4 border border-border mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <h2 className="font-bold text-sm">Pengaturan Notifikasi WA</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Atur jam, hari aktif, status, dan template per tahap. Placeholder: <code>{`{nama}`}</code>, <code>{`{tanggal}`}</code>, <code>{`{kelas}`}</code>, <code>{`{tempat}`}</code>, <code>{`{daftar}`}</code> (khusus guru).
      </p>

      <div className="flex gap-1 border-b border-border">
        {(["global", "override"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-xs font-semibold ${tab === k ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          >
            {k === "global" ? "Global" : `Per Siswa (${Object.values(overrides).filter((o: any) => o.disable_all || o.skip_siswa || o.skip_pulang || o.skip_ortu || o.skip_dudi || o.skip_guru).length})`}
          </button>
        ))}
      </div>

      {tab === "global" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-2 space-y-2 bg-muted/30">
            <div className="font-semibold text-xs">Konfigurasi Pengirim Fonnte</div>
            <div>
              <Label className="text-[10px]">Nomor HP Pengirim (device Fonnte)</Label>
              <Input
                placeholder="contoh: 085126998835"
                value={s.fonnte_sender ?? ""}
                onChange={(e) => setS({ ...s, fonnte_sender: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px]">Token Fonnte</Label>
              <Input
                type="password"
                placeholder="Token dari dashboard Fonnte"
                value={s.fonnte_token ?? ""}
                onChange={(e) => setS({ ...s, fonnte_token: e.target.value })}
                className="h-7 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Token disimpan di database. Jika kosong, sistem memakai token dari environment.
              </p>
              <Button onClick={save} disabled={busy} size="sm" className="w-full gap-1 mt-2">
                <Save className="w-3 h-3" /> {busy ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Hari aktif</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {HARI.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleHari(i)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${s.hari_aktif.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-2 space-y-2 bg-muted/30">
            <Label className="text-[10px]">Jeda antar pengiriman (menit)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              step="0.1"
              value={s.jeda_menit ?? 0}
              onChange={(e) => setS({ ...s, jeda_menit: Number(e.target.value) || 0 })}
              className="h-7 text-xs w-32"
            />
            <p className="text-[10px] text-muted-foreground">
              Jeda waktu (dalam menit) setelah berhasil mengirim 1 notifikasi WhatsApp sebelum mengirim notifikasi berikutnya. Berguna untuk menghindari rate-limit Fonnte. Isi 0 untuk tanpa jeda.
            </p>
          </div>

          {(["siswa", "pulang", "ortu", "dudi", "guru"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-border p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-xs capitalize">
                  {k === "guru" ? "Guru (ringkasan)" : k === "siswa" ? "Siswa (belum absen masuk)" : k === "pulang" ? "Siswa (belum absen pulang)" : k}
                </div>
                <label className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={(s as any)[`aktif_${k}`]}
                    onChange={(e) => setS({ ...s, [`aktif_${k}`]: e.target.checked } as Settings)}
                  />
                  Aktif
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] w-14">Jam</Label>
                <Input
                  type="time"
                  value={((s as any)[`jam_${k}`] as string).slice(0, 5)}
                  onChange={(e) => setS({ ...s, [`jam_${k}`]: e.target.value } as Settings)}
                  className="h-7 text-xs w-32"
                />
              </div>
              <div>
                <Label className="text-[10px]">Template</Label>
                <Textarea
                  rows={3}
                  value={(s as any)[`template_${k}`]}
                  onChange={(e) => setS({ ...s, [`template_${k}`]: e.target.value } as Settings)}
                  className="text-xs"
                />
              </div>
            </div>
          ))}

          <Button onClick={save} disabled={busy} size="sm" className="w-full gap-1">
            <Save className="w-3 h-3" /> {busy ? "Menyimpan…" : "Simpan Pengaturan"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Catatan: jam di atas memakai zona <b>WITA (Asia/Makassar)</b>. Sistem memeriksa jadwal setiap 5 menit, sehingga pengiriman berlangsung pada jam yang Anda tetapkan (toleransi ±5 menit). Sebaiknya isi jam dengan kelipatan 5 menit.
          </p>
        </div>
      )}

      {tab === "override" && (
        <div className="space-y-2">
          <Input
            placeholder="Cari siswa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {filtered.length === 0 && <p className="text-[11px] text-muted-foreground">Tidak ada siswa.</p>}
            {filtered.map((r) => {
              const ov = overrides[r.user_id!] ?? {};
              const Chip = ({ k, label }: { k: string; label: string }) => (
                <label className="flex items-center gap-1 text-[10px]">
                  <input
                    type="checkbox"
                    checked={!!ov[k]}
                    onChange={(e) => saveOverride(r.user_id!, { [k]: e.target.checked })}
                  />
                  {label}
                </label>
              );
              return (
                <div key={r.id} className="border border-border rounded-lg p-2">
                  <div className="text-xs font-semibold truncate">{r.nama_lengkap}</div>
                  <div className="text-[10px] text-muted-foreground">{r.kelas || "-"}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    <Chip k="disable_all" label="Matikan semua" />
                    <Chip k="skip_siswa" label="skip masuk" />
                    <Chip k="skip_pulang" label="skip pulang" />
                    <Chip k="skip_ortu" label="skip ortu" />
                    <Chip k="skip_dudi" label="skip DUDI" />
                    <Chip k="skip_guru" label="skip guru" />
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      Hari aktif {ov.hari_aktif ? "(khusus)" : "(ikuti global)"}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {HARI.map((h, i) => {
                        const cur: number[] | null = ov.hari_aktif ?? null;
                        const active = cur ? cur.includes(i) : false;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const base = cur ?? s.hari_aktif;
                              const next = base.includes(i) ? base.filter((x) => x !== i) : [...base, i].sort();
                              saveOverride(r.user_id!, { hari_aktif: next });
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
                          >
                            {h}
                          </button>
                        );
                      })}
                      {ov.hari_aktif && (
                        <button
                          type="button"
                          onClick={() => saveOverride(r.user_id!, { hari_aktif: null })}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border text-muted-foreground"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}