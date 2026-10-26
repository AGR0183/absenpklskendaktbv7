import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone, sendFonnte, loadWaSettings, renderTemplate, type MissingSiswa } from "./wa.server";

type Tahap = "siswa" | "ortu" | "dudi" | "guru";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) throw new Error("Hanya admin yang boleh menjalankan uji coba.");
}

async function getBelumAbsenForDate(tgl: string, onlyUserIds?: string[]): Promise<MissingSiswa[]> {
  const { data: roleRows, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "siswa");
  if (rErr) throw new Error(rErr.message);
  let siswaIds = (roleRows ?? []).map((r: any) => r.user_id as string);
  if (onlyUserIds && onlyUserIds.length > 0) {
    const filterSet = new Set(onlyUserIds);
    siswaIds = siswaIds.filter((id) => filterSet.has(id));
  }
  if (siswaIds.length === 0) return [];

  const { data: att } = await supabaseAdmin
    .from("attendance")
    .select("user_id, jenis")
    .eq("tanggal", tgl)
    .in("jenis", ["masuk", "izin", "sakit"]);
  const sudah = new Set<string>((att ?? []).map((a: any) => a.user_id as string));
  const belumIds = siswaIds.filter((id) => !sudah.has(id));
  if (belumIds.length === 0) return [];

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, nama_siswa, kelas, tempat_magang, no_hp_siswa, no_hp_ortu, no_hp_guru, no_hp_dudi" as any)
    .in("id", belumIds);
  return ((profiles ?? []) as unknown) as MissingSiswa[];
}

async function logTest(userId: string, tahap: Tahap, status: "sent" | "failed" | "skipped", detail?: string) {
  await supabaseAdmin
    .from("wa_reminder_log")
    .insert({ user_id: userId, tahap: `test-${tahap}`, status, detail: detail ?? null } as any);
}

type StageResult = { tahap: Tahap; total: number; sent: number; skipped: number; failed: number; errors: string[] };

async function runStage(
  list: MissingSiswa[],
  tahap: Tahap,
  tgl: string,
  buildMsg: (s: MissingSiswa) => { phone: string | null; message: string },
  dryRun: boolean,
): Promise<StageResult> {
  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];
  for (const s of list) {
    const { phone, message } = buildMsg(s);
    if (!phone) {
      await logTest(s.id, tahap, "skipped", "no HP kosong / tidak valid");
      skipped++;
      continue;
    }
    if (dryRun) {
      await logTest(s.id, tahap, "skipped", `[DRY] ${phone}`);
      skipped++;
      continue;
    }
    const r = await sendFonnte(phone, message);
    if (r.ok) { await logTest(s.id, tahap, "sent", `[TEST ${tgl}] ${phone}`); sent++; }
    else {
      await logTest(s.id, tahap, "failed", r.error);
      failed++;
      if (errors.length < 3) errors.push(`${s.nama_siswa ?? s.id} (${phone}): ${r.error ?? "unknown"}`);
    }
  }
  return { tahap, total: list.length, sent, skipped, failed, errors };
}

export const runWaTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
        dryRun: z.boolean().optional().default(false),
        stages: z.array(z.enum(["siswa", "ortu", "dudi", "guru"])).optional(),
        userIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const tgl = data.tanggal;
    const list = await getBelumAbsenForDate(tgl, data.userIds);
    const settings = await loadWaSettings();
    const stagesSet = new Set<Tahap>(
      (data.stages && data.stages.length > 0 ? data.stages : ["siswa", "ortu", "dudi", "guru"]) as Tahap[],
    );
    const empty = (t: Tahap): StageResult => ({ tahap: t, total: list.length, sent: 0, skipped: 0, failed: 0, errors: [] });

    const tplSiswa = settings?.template_siswa ??
      `Halo {nama},\n\nAnda belum melakukan absensi PKL pada {tanggal}. Silakan segera melakukan absensi atau memberikan konfirmasi.\n\n— SIAP PKL SMKN 2 Kotabaru`;
    const tplOrtu = settings?.template_ortu ??
      `Yth. Orang Tua/Wali {nama},\n\nPutra/putri Anda belum melakukan absensi PKL pada {tanggal}. Mohon konfirmasinya.\n\n— SMKN 2 Kotabaru`;
    const tplDudi = settings?.template_dudi ??
      `Yth. Pembimbing DUDI {tempat},\n\nSiswa {nama} ({kelas}) belum melakukan absensi PKL pada {tanggal}. Mohon konfirmasi kehadirannya.\n\n— SMKN 2 Kotabaru`;
    const tplGuru = settings?.template_guru ??
      `Ringkasan siswa PKL yang belum absen pada {tanggal}:\n\n{daftar}\n\n— SMKN 2 Kotabaru`;

    const buildVars = (s: MissingSiswa) => ({
      nama: s.nama_siswa ?? "-",
      tanggal: tgl,
      kelas: s.kelas ?? "-",
      tempat: s.tempat_magang ?? "-",
    });

    const siswaRes = stagesSet.has("siswa") ? await runStage(list, "siswa", tgl, (s) => ({
      phone: normalizePhone(s.no_hp_siswa),
      message: `[UJI COBA] ` + renderTemplate(tplSiswa, buildVars(s)),
    }), data.dryRun) : empty("siswa");

    const ortuRes = stagesSet.has("ortu") ? await runStage(list, "ortu", tgl, (s) => ({
      phone: normalizePhone(s.no_hp_ortu),
      message: `[UJI COBA] ` + renderTemplate(tplOrtu, buildVars(s)),
    }), data.dryRun) : empty("ortu");

    const dudiRes = stagesSet.has("dudi") ? await runStage(list, "dudi", tgl, (s) => ({
      phone: normalizePhone(s.no_hp_dudi),
      message: `[UJI COBA] ` + renderTemplate(tplDudi, buildVars(s)),
    }), data.dryRun) : empty("dudi");

    // Guru summary: group missing siswa per guru phone
    const byGuru = new Map<string, MissingSiswa[]>();
    if (stagesSet.has("guru")) for (const s of list) {
      const phone = normalizePhone(s.no_hp_guru);
      if (!phone) continue;
      const arr = byGuru.get(phone) ?? [];
      arr.push(s);
      byGuru.set(phone, arr);
    }
    let gSent = 0, gFailed = 0, gSkipped = 0;
    const gErrors: string[] = [];
    for (const [phone, arr] of byGuru) {
      const daftar = arr.map((x, i) => `${i + 1}. ${x.nama_siswa ?? "-"} (${x.kelas ?? "-"}) — ${x.tempat_magang ?? "-"}`).join("\n");
      const msg = `[UJI COBA] ` + renderTemplate(tplGuru, { tanggal: tgl, daftar });
      if (data.dryRun) {
        for (const x of arr) await logTest(x.id, "guru", "skipped", `[DRY] ${phone}`);
        gSkipped += arr.length;
        continue;
      }
      const r = await sendFonnte(phone, msg);
      if (r.ok) { for (const x of arr) await logTest(x.id, "guru", "sent", `[TEST ${tgl}] ${phone}`); gSent += arr.length; }
      else {
        for (const x of arr) await logTest(x.id, "guru", "failed", r.error);
        gFailed += arr.length;
        if (gErrors.length < 3) gErrors.push(`${phone}: ${r.error ?? "unknown"}`);
      }
    }
    const guruRes: StageResult = { tahap: "guru", total: list.length, sent: gSent, skipped: gSkipped, failed: gFailed, errors: gErrors };

    return {
      tanggal: tgl,
      dryRun: data.dryRun,
      totalBelumAbsen: list.length,
      stages: [siswaRes, ortuRes, dudiRes, guruRes],
    };
  });