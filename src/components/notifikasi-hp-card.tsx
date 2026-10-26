import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, BellRing } from "lucide-react";
import { enablePush, listenForeground, pushPermission } from "@/lib/push";
import { savePushToken, removePushToken, testPushToSelf } from "@/lib/push.functions";

const LS_KEY = "siappkl_push_token";

export function NotifikasiHpCard() {
  const saveFn = useServerFn(savePushToken);
  const removeFn = useServerFn(removePushToken);
  const testFn = useServerFn(testPushToSelf);
  const [busy, setBusy] = useState(false);
  const [aktif, setAktif] = useState(false);
  const [perm, setPerm] = useState<string>("default");

  useEffect(() => {
    setPerm(pushPermission());
    setAktif(!!localStorage.getItem(LS_KEY) && pushPermission() === "granted");
    listenForeground((title, body) => toast(title, { description: body }));

    // Aktivasi otomatis: hanya bisa jika izin SUDAH diberikan sebelumnya
    // (browser melarang meminta izin tanpa klik pengguna).
    if (pushPermission() === "granted") {
      (async () => {
        try {
          const r = await enablePush();
          if (r.status === "registered") {
            const lama = localStorage.getItem(LS_KEY);
            if (lama !== r.token) {
              await saveFn({ data: { token: r.token, platform: navigator.userAgent.slice(0, 120) } });
              localStorage.setItem(LS_KEY, r.token);
            }
            setAktif(true);
          }
        } catch {
          /* diam saja — pengguna masih bisa aktifkan manual lewat tombol */
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aktifkan = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r.status === "registered") {
        await saveFn({ data: { token: r.token, platform: navigator.userAgent.slice(0, 120) } });
        localStorage.setItem(LS_KEY, r.token);
        setAktif(true);
        setPerm("granted");
        toast.success("Notifikasi HP aktif", {
          description: "Pengingat absen akan muncul di layar HP Anda.",
        });
      } else if (r.status === "open-in-new-tab") {
        toast.error("Buka di tab sendiri", {
          description: "Izin notifikasi tidak bisa diminta di dalam pratinjau. Buka aplikasi di tab/browser HP langsung.",
        });
      } else if (r.status === "denied") {
        toast.error("Izin notifikasi ditolak", {
          description: "Aktifkan notifikasi untuk situs ini di pengaturan browser Anda.",
        });
      } else if (r.status === "unsupported") {
        toast.error("Perangkat/browser tidak mendukung notifikasi");
      } else {
        toast.error("Notifikasi belum dikonfigurasi", { description: "Hubungi admin sekolah." });
      }
    } catch (e: any) {
      toast.error("Gagal mengaktifkan", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const matikan = async () => {
    const token = localStorage.getItem(LS_KEY);
    setBusy(true);
    try {
      if (token) await removeFn({ data: { token } });
      localStorage.removeItem(LS_KEY);
      setAktif(false);
      toast.success("Notifikasi di perangkat ini dimatikan");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const uji = async () => {
    setBusy(true);
    try {
      const r: any = await testFn({});
      if (r?.sent > 0) toast.success("Notifikasi uji terkirim");
      else toast.error("Belum ada perangkat aktif / gagal kirim");
    } catch (e: any) {
      toast.error("Gagal", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 border border-border space-y-3">
      <div className="flex items-center gap-2">
        {aktif ? <BellRing className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4 text-primary" />}
        <h3 className="font-bold text-sm">Notifikasi di HP</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Aktifkan agar pengingat “belum absen” muncul langsung di layar HP, sama seperti pengingat WhatsApp.
        Untuk hasil terbaik, tambahkan aplikasi ini ke layar utama (Add to Home Screen) lalu aktifkan notifikasi.
        {perm === "denied" && (
          <> Izin notifikasi saat ini diblokir — ubah di pengaturan situs pada browser Anda.</>
        )}
      </p>
      <div className="flex gap-2">
        {aktif ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={matikan} disabled={busy} className="flex-1">
              Matikan
            </Button>
            <Button type="button" size="sm" onClick={uji} disabled={busy}>
              Uji Notifikasi
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={aktifkan} disabled={busy} className="flex-1">
            {busy ? "Memproses…" : "Aktifkan Notifikasi"}
          </Button>
        )}
      </div>
    </div>
  );
}
