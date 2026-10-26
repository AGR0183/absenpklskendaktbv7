import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportAllData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const {
      assertAdminRole,
      fetchAllRows,
      fetchProfileMap,
      csvEscape,
    } = await import("./backup.server");
    await assertAdminRole(context.supabase, context.userId);
    const [rows, profiles] = await Promise.all([fetchAllRows(), fetchProfileMap()]);
    const header = [
      "nama_siswa","kelas","tempat_magang","no_hp_siswa","no_hp_ortu","no_hp_guru","no_hp_dudi",
      "jenis","tanggal","waktu","nama_lokasi","latitude","longitude","ada_foto",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const p = profiles[r.user_id] ?? {};
      lines.push([
        p.nama_siswa, p.kelas, p.tempat_magang, p.no_hp_siswa, p.no_hp_ortu, p.no_hp_guru, p.no_hp_dudi,
        r.jenis, r.tanggal, r.waktu, r.nama_lokasi, r.latitude, r.longitude, r.photo_url ? "ya" : "tidak",
      ].map(csvEscape).join(","));
    }
    return { csv: lines.join("\n"), total: rows.length };
  });

export const listAllPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminRole, fetchAllRows, fetchProfileMap, toPath, signPhotos } =
      await import("./backup.server");
    await assertAdminRole(context.supabase, context.userId);
    const [rows, profiles] = await Promise.all([fetchAllRows(), fetchProfileMap()]);
    const meta: Record<string, string> = {};
    const paths: string[] = [];
    for (const r of rows) {
      const p = toPath(r.photo_url);
      if (!p) continue;
      const nama = (profiles[r.user_id]?.nama_siswa ?? "tanpa-nama").replace(/[^\w\s-]/g, "").trim();
      const ext = p.split(".").pop()?.slice(0, 5) || "jpg";
      meta[p] = `${r.tanggal}/${nama}-${r.jenis}-${r.id.slice(0, 6)}.${ext}`;
      paths.push(p);
    }
    const signed = await signPhotos(paths);
    return signed.map((s) => ({ url: s.url, name: meta[s.path] ?? s.path }));
  });

export const deleteAllPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminRole, removeAllPhotos } = await import("./backup.server");
    await assertAdminRole(context.supabase, context.userId);
    const removed = await removeAllPhotos();
    return { removed };
  });
