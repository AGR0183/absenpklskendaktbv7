import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListPins, adminResetPin, adminUnlockPin, adminUnlockAllPins } from "@/lib/auth-pin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, RotateCw, Lock, LockOpen } from "lucide-react";

export function PinListCard() {
  const listFn = useServerFn(adminListPins);
  const resetFn = useServerFn(adminResetPin);
  const unlockFn = useServerFn(adminUnlockPin);
  const unlockAllFn = useServerFn(adminUnlockAllPins);
  const [data, setData] = useState<{ siswa: any[]; staf: any[] } | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [onlyLocked, setOnlyLocked] = useState(false);

  const refresh = () => listFn({}).then(setData).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const reset = async (user_id: string, nama: string) => {
    const nv = prompt(`Reset PIN ${nama} ke (4-6 digit):`, "1234");
    if (!nv || !/^[0-9]{4,6}$/.test(nv)) return;
    try {
      await resetFn({ data: { user_id, newPin: nv } });
      toast.success(`PIN ${nama} di-reset`);
      refresh();
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    }
  };

  const unlock = async (user_id: string, nama: string) => {
    try {
      await unlockFn({ data: { user_id } });
      toast.success(`Kunci ${nama} dibuka`);
      refresh();
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    }
  };

  const unlockAll = async () => {
    if (!confirm("Buka kunci semua akun yang terkunci?")) return;
    try {
      await unlockAllFn({});
      toast.success("Semua kunci dibuka");
      refresh();
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    }
  };

  if (!data) return null;

  const all = [
    ...data.staf.map((p) => ({ user_id: p.user_id, nama: p.nama, sub: (p.roles ?? []).join("/").toUpperCase(), pin: p.pin, locked: !!p.locked })),
    ...data.siswa.map((s) => ({ user_id: s.user_id, nama: s.nama, sub: `SISWA · ${s.kelas ?? "-"}`, pin: s.pin, locked: !!s.locked })),
  ];
  const lockedCount = all.filter((r) => r.locked).length;
  const filtered = all.filter((r) => {
    if (onlyLocked && !r.locked) return false;
    const t = filter.trim().toLowerCase();
    if (!t) return true;
    return [r.nama, r.sub].some((v) => (v ?? "").toLowerCase().includes(t));
  });

  return (
    <div className="bg-card rounded-2xl p-4 border border-border mb-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4" />
        <h2 className="font-bold text-sm">Daftar PIN ({all.length})</h2>
        {lockedCount > 0 && (
          <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
            {lockedCount} terkunci
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Input placeholder="Cari nama / peran / kelas…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 text-xs flex-1 min-w-40" />
        <Button size="sm" variant={onlyLocked ? "default" : "outline"} className="h-8 px-2 text-[11px] gap-1" onClick={() => setOnlyLocked((v) => !v)}>
          <Lock className="w-3 h-3" /> Terkunci
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2 text-[11px] gap-1" disabled={lockedCount === 0} onClick={unlockAll}>
          <LockOpen className="w-3 h-3" /> Buka Semua
        </Button>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-1">
        {filtered.map((r) => (
          <div key={r.user_id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate flex items-center gap-1">
                {r.nama}
                {r.locked && <Lock className="w-3 h-3 text-destructive shrink-0" />}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.sub}{r.locked ? " · terkunci" : ""}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{show[r.user_id] ? r.pin : "••••"}</code>
              <button type="button" onClick={() => setShow({ ...show, [r.user_id]: !show[r.user_id] })} className="text-muted-foreground">
                {show[r.user_id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              {r.locked && (
                <Button size="sm" variant="default" className="h-6 px-2 text-[10px] gap-1" onClick={() => unlock(r.user_id, r.nama)}>
                  <LockOpen className="w-3 h-3" /> Buka
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => reset(r.user_id, r.nama)}>
                <RotateCw className="w-3 h-3" /> Reset
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
