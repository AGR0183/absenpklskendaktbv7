import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "attendance-photos";

export async function assertAdminRole(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) throw new Error("Akses ditolak: hanya admin.");
}

export function toPath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const marker = "/attendance-photos/";
  const i = urlOrPath.indexOf(marker);
  if (i >= 0) return urlOrPath.substring(i + marker.length);
  if (/^https?:\/\//i.test(urlOrPath)) return null;
  return urlOrPath;
}

export async function fetchAllRows() {
  const pageSize = 1000;
  const all: any[] = [];
  for (let page = 0; page < 60; page++) {
    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("id,user_id,jenis,tanggal,waktu,nama_lokasi,latitude,longitude,photo_url")
      .order("tanggal", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export async function fetchProfileMap() {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,nama_siswa,kelas,tempat_magang,no_hp_siswa,no_hp_ortu,no_hp_guru,no_hp_dudi");
  const map: Record<string, any> = {};
  for (const p of data ?? []) map[p.id] = p;
  return map;
}

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function signPhotos(paths: string[], expiresIn = 3600) {
  const out: { path: string; url: string }[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(chunk, expiresIn);
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) out.push({ path: d.path, url: d.signedUrl });
    }
  }
  return out;
}

export async function removeAllPhotos() {
  let removed = 0;
  for (let i = 0; i < 60; i++) {
    const { data: rows, error } = await supabaseAdmin
      .from("attendance")
      .select("id, photo_url")
      .not("photo_url", "is", null)
      .limit(500);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;
    const paths: string[] = [];
    const ids: string[] = [];
    for (const r of rows) {
      const p = toPath(r.photo_url);
      if (p) paths.push(p);
      ids.push(r.id);
    }
    if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
    const { error: updErr } = await supabaseAdmin
      .from("attendance")
      .update({ photo_url: null })
      .in("id", ids);
    if (updErr) throw new Error(updErr.message);
    removed += paths.length;
    if (rows.length < 500) break;
  }
  return removed;
}
