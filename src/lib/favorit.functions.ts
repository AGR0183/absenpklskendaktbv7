import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normPhone(v: string | null | undefined): string {
  if (!v) return "";
  let d = String(v).replace(/\D/g, "");
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Tandai otomatis siswa sebagai favorit bila no_hp_guru pada profil siswa
 * sama dengan nomor HP guru yang sedang login.
 */
export const syncFavoritByGuruPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("guru") && !roles.includes("admin")) return { added: [] as string[] };

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("no_hp_siswa")
      .eq("id", context.userId)
      .maybeSingle();
    const myPhone = normPhone(me?.no_hp_siswa);
    if (!myPhone) return { added: [] as string[] };

    const [{ data: siswaRoles }, { data: profs }, { data: favs }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "siswa"),
      supabaseAdmin.from("profiles").select("id,no_hp_guru"),
      supabaseAdmin.from("guru_favorit_siswa").select("siswa_id").eq("guru_id", context.userId),
    ]);
    const siswaIds = new Set((siswaRoles ?? []).map((r: { user_id: string }) => r.user_id));
    const already = new Set((favs ?? []).map((r: { siswa_id: string }) => r.siswa_id));
    const target = (profs ?? [])
      .filter((p) => siswaIds.has(p.id) && normPhone(p.no_hp_guru) === myPhone)
      .map((p) => p.id)
      .filter((id) => !already.has(id));
    if (target.length === 0) return { added: [] as string[] };
    const { error } = await supabaseAdmin
      .from("guru_favorit_siswa")
      .insert(target.map((siswa_id) => ({ guru_id: context.userId, siswa_id })));
    if (error) throw new Error(error.message);
    return { added: target };
  });
