import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { HOLIDAYS as NATIONAL_HOLIDAYS } from "@/lib/holidays";

/** Normalisasi nomor HP Indonesia ke format 628xxx (sesuai Fonnte) */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).replace(/[^0-9]/g, "");
  if (!s) return null;
  if (s.startsWith("62")) {
    // ok
  } else if (s.startsWith("0")) {
    s = "62" + s.slice(1);
  } else if (s.startsWith("8")) {
    s = "62" + s;
  } else {
    return null;
  }
  if (s.length < 10 || s.length > 15) return null;
  return s;
}

/** Kirim pesan WA via Fonnte */
export async function sendFonnte(target: string, message: string): Promise<{ ok: boolean; error?: string }> {
  let token: string | undefined | null = undefined;
  try {
    const { data } = await supabaseAdmin
      .from("wa_schedule_settings" as any)
      .select("fonnte_token")
      .eq("id", 1)
      .maybeSingle();
    token = (data as any)?.fonnte_token || null;
  } catch {
    /* ignore */
  }
  if (!token) token = process.env.FONNTE_TOKEN;
  if (!token) return { ok: false, error: "FONNTE_TOKEN missing" };
  try {
    const form = new URLSearchParams();
    form.set("target", target);
    form.set("message", message);
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    try {
      const j = JSON.parse(text);
      if (j.status === false) return { ok: false, error: j.reason ?? text.slice(0, 200) };
    } catch {
      // non-JSON ok
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export type MissingSiswa = {
  id: string;
  nama_siswa: string | null;
  kelas: string | null;
  tempat_magang: string | null;
  no_hp_siswa: string | null;
  no_hp_ortu: string | null;
  no_hp_guru: string | null;
  no_hp_dudi: string | null;
};

/** Tanggal hari ini di WITA (Asia/Makassar) dalam format YYYY-MM-DD */
export function todayWita(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

/**
 * Ambil siswa yang BELUM ada absensi jenis 'masuk' / 'izin' / 'sakit' hari ini.
 * Hanya siswa (role 'siswa') yang dihitung.
 */
export async function getSiswaBelumAbsen(): Promise<MissingSiswa[]> {
  const tgl = todayWita();

  // Ambil seluruh user dengan role 'siswa'
  const { data: roleRows, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "siswa");
  if (rErr) throw new Error(rErr.message);
  const siswaIds = (roleRows ?? []).map((r: any) => r.user_id as string);
  if (siswaIds.length === 0) return [];

  // Ambil attendance hari ini (semua jenis "konfirmasi": masuk, izin, sakit)
  const { data: att } = await supabaseAdmin
    .from("attendance")
    .select("user_id, jenis")
    .eq("tanggal", tgl)
    .in("jenis", ["masuk", "izin", "sakit"]);
  const sudah = new Set<string>((att ?? []).map((a: any) => a.user_id as string));

  const belumIds = siswaIds.filter((id) => !sudah.has(id));
  if (belumIds.length === 0) return [];

  // Ambil profil siswa yang belum absen
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, nama_siswa, kelas, tempat_magang, no_hp_siswa, no_hp_ortu, no_hp_guru, no_hp_dudi" as any)
    .in("id", belumIds);

  return ((profiles ?? []) as unknown) as MissingSiswa[];
}

/** Cek apakah pengingat untuk siswa+tahap hari ini sudah pernah dikirim */
export async function alreadySent(userId: string, tahap: "siswa" | "pulang" | "ortu" | "dudi" | "guru"): Promise<boolean> {
  const tgl = todayWita();
  const { data } = await supabaseAdmin
    .from("wa_reminder_log")
    .select("id")
    .eq("user_id", userId)
    .eq("tanggal", tgl)
    .eq("tahap", tahap)
    .maybeSingle();
  return !!data;
}

/** Catat log pengingat */
export async function logReminder(
  userId: string,
  tahap: "siswa" | "pulang" | "ortu" | "dudi" | "guru",
  status: "sent" | "failed" | "skipped",
  detail?: string,
) {
  await supabaseAdmin
    .from("wa_reminder_log")
    .insert({ user_id: userId, tahap, status, detail: detail ?? null } as any);
}

/* --------------------------- Settings helpers --------------------------- */

export type WaSettings = {
  jam_siswa: string; jam_pulang: string; jam_ortu: string; jam_dudi: string; jam_guru: string;
  aktif_siswa: boolean; aktif_pulang: boolean; aktif_ortu: boolean; aktif_dudi: boolean; aktif_guru: boolean;
  template_siswa: string; template_pulang: string; template_ortu: string; template_dudi: string; template_guru: string;
  hari_aktif: number[];
  jeda_menit?: number;
};

export async function loadWaSettings(): Promise<WaSettings | null> {
  const { data } = await supabaseAdmin
    .from("wa_schedule_settings" as any)
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as unknown as WaSettings) ?? null;
}

export async function loadWaOverrides(): Promise<Map<string, {
  disable_all: boolean; skip_siswa: boolean; skip_pulang: boolean; skip_ortu: boolean; skip_dudi: boolean; skip_guru: boolean;
  hari_aktif: number[] | null; tanggal_libur: string[] | null;
}>> {
  const { data } = await supabaseAdmin.from("wa_schedule_overrides" as any).select("*");
  const m = new Map<string, any>();
  for (const r of (data ?? []) as any[]) m.set(r.siswa_user_id, r);
  return m;
}

/** Cek apakah hari ini aktif untuk siswa tertentu.
 *  Jika siswa punya override hari_aktif (non-null & tidak kosong), itu yang dipakai.
 *  Jika tidak, fallback ke setting global.
 */
export function isDayActiveForSiswa(
  override: { hari_aktif: number[] | null; tanggal_libur?: string[] | null } | undefined,
  globalHari: number[],
): boolean {
  const dow = dowWita();
  if (override?.tanggal_libur && override.tanggal_libur.includes(todayWita())) return false;
  if (override?.hari_aktif && override.hari_aktif.length > 0) {
    return override.hari_aktif.includes(dow);
  }
  return globalHari.includes(dow);
}

/** Hari aktif berdasarkan WITA (0=Min..6=Sab). */
export function dowWita(): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    weekday: "short",
  }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(s);
}

export { HOLIDAYS } from "@/lib/holidays";

/** Apakah hari ini termasuk hari libur (WITA). */
export function isHolidayToday(): boolean {
  return NATIONAL_HOLIDAYS.includes(todayWita());
}

/** Apply template placeholders. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Sleep helper untuk memberi jeda antar pengiriman WA */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Menit sejak 00:00 pada waktu WITA (Asia/Makassar) */
export function nowWitaMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** Ubah "HH:MM(:SS)" menjadi menit; null bila tidak valid */
export function parseJamToMinutes(jam: string | null | undefined): number | null {
  if (!jam) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(jam));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  return h * 60 + mi;
}
/**
 * Ambil siswa yang sudah absen MASUK hari ini tetapi BELUM absen PULANG.
 * Siswa dengan status izin/sakit hari ini dikecualikan.
 */
export async function getSiswaBelumAbsenPulang(): Promise<MissingSiswa[]> {
  const tgl = todayWita();

  const { data: roleRows, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "siswa");
  if (rErr) throw new Error(rErr.message);
  const siswaIds = new Set<string>((roleRows ?? []).map((r: any) => r.user_id as string));
  if (siswaIds.size === 0) return [];

  const { data: att } = await supabaseAdmin
    .from("attendance")
    .select("user_id, jenis")
    .eq("tanggal", tgl);

  const masuk = new Set<string>();
  const selesai = new Set<string>();
  for (const a of (att ?? []) as any[]) {
    if (a.jenis === "masuk") masuk.add(a.user_id);
    if (a.jenis === "pulang" || a.jenis === "izin" || a.jenis === "sakit") selesai.add(a.user_id);
  }

  const belumIds = [...masuk].filter((id) => siswaIds.has(id) && !selesai.has(id));
  if (belumIds.length === 0) return [];

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, nama_siswa, kelas, tempat_magang, no_hp_siswa, no_hp_ortu, no_hp_guru, no_hp_dudi" as any)
    .in("id", belumIds);

  return ((profiles ?? []) as unknown) as MissingSiswa[];
}

/* ----------------------- Helper untuk notifikasi GURU ---------------------- */

/** Peta nomor HP guru (ternormalisasi) -> user_id akun guru. */
export async function getGuruPhoneMap(): Promise<Map<string, { userId: string; nama: string | null }>> {
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "guru");
  const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id as string)));
  const map = new Map<string, { userId: string; nama: string | null }>();
  if (ids.length === 0) return map;
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, nama_siswa, no_hp_siswa, no_hp_guru" as any)
    .in("id", ids);
  for (const p of (profs ?? []) as any[]) {
    for (const raw of [p.no_hp_siswa, p.no_hp_guru]) {
      const ph = normalizePhone(raw);
      if (ph && !map.has(ph)) map.set(ph, { userId: p.id, nama: p.nama_siswa ?? null });
    }
  }
  return map;
}

/** Map guru userId -> Set siswa_id favoritnya (untuk membatasi push notifikasi). */
export async function getGuruFavoritMap(): Promise<Map<string, Set<string>>> {
  const { data } = await supabaseAdmin
    .from("guru_favorit_siswa")
    .select("guru_id, siswa_id");
  const map = new Map<string, Set<string>>();
  for (const r of (data ?? []) as any[]) {
    if (!map.has(r.guru_id)) map.set(r.guru_id, new Set());
    map.get(r.guru_id)!.add(r.siswa_id);
  }
  return map;
}

export type SiswaTerlambat = MissingSiswa & { jam: string };

/**
 * Siswa yang absen MASUK hari ini melewati batas jam (WITA) dan baru saja
 * tercatat dalam `windowMenit` terakhir — supaya notifikasi tidak dobel.
 */
export async function getSiswaTerlambatBaru(
  batasMenit: number,
  windowMenit: number,
): Promise<SiswaTerlambat[]> {
  const tgl = todayWita();
  const sinceIso = new Date(Date.now() - windowMenit * 60_000).toISOString();

  const { data: att } = await supabaseAdmin
    .from("attendance")
    .select("user_id, waktu, created_at")
    .eq("tanggal", tgl)
    .eq("jenis", "masuk")
    .gte("created_at", sinceIso);

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const late = new Map<string, string>();
  for (const a of (att ?? []) as any[]) {
    const d = new Date(a.waktu ?? a.created_at);
    const parts = fmt.formatToParts(d);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mi = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    if (h * 60 + mi > batasMenit) late.set(a.user_id as string, `${String(h).padStart(2, "0")}.${String(mi).padStart(2, "0")}`);
  }
  if (late.size === 0) return [];

  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "siswa")
    .in("user_id", [...late.keys()]);
  const siswaIds = (roleRows ?? []).map((r: any) => r.user_id as string);
  if (siswaIds.length === 0) return [];

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, nama_siswa, kelas, tempat_magang, no_hp_siswa, no_hp_ortu, no_hp_guru, no_hp_dudi" as any)
    .in("id", siswaIds);

  return ((profiles ?? []) as any[]).map((p) => ({ ...p, jam: late.get(p.id) ?? "-" })) as SiswaTerlambat[];
}
