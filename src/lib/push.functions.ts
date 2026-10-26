import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Simpan token perangkat milik user yang sedang login */
export const savePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ token: z.string().min(20), platform: z.string().max(120).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_tokens" as any)
      .upsert(
        {
          token: data.token,
          user_id: context.userId,
          platform: data.platform ?? null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "token" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hapus token perangkat (matikan notifikasi di perangkat ini) */
export const removePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_tokens" as any)
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Kirim notifikasi uji ke perangkat sendiri */
export const testPushToSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUser } = await import("@/lib/push.server");
    return await sendPushToUser(
      context.userId,
      "Uji notifikasi SIAP PKL",
      "Notifikasi di perangkat ini sudah aktif.",
    );
  });
