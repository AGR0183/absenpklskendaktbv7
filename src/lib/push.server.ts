import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

async function sendToToken(token: string, title: string, body: string, path = "/beranda") {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const connectionApiKey = process.env.FIREBASE_MESSAGING_API_KEY;
  if (!LOVABLE_API_KEY) return { ok: false, status: 0, error: "LOVABLE_API_KEY missing" };
  if (!connectionApiKey) return { ok: false, status: 0, error: "FIREBASE_MESSAGING_API_KEY missing" };

  const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": connectionApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { path },
        webpush: {
          notification: { icon: "/icon-512.png", badge: "/icon-512.png" },
          fcm_options: { link: path },
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[FCM] send failed [${res.status}]: ${text}`);
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, status: res.status };
}

/** Kirim notifikasi ke semua perangkat milik satu user. Token basi otomatis dihapus. */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  path = "/beranda",
): Promise<{ sent: number; failed: number; devices: number }> {
  const { data } = await supabaseAdmin
    .from("push_tokens" as any)
    .select("token")
    .eq("user_id", userId);
  const tokens = ((data ?? []) as any[]).map((r) => r.token as string);
  let sent = 0;
  let failed = 0;
  for (const t of tokens) {
    const r = await sendToToken(t, title, body, path);
    if (r.ok) sent++;
    else {
      failed++;
      if (r.status === 404 || r.status === 400) {
        await supabaseAdmin.from("push_tokens" as any).delete().eq("token", t);
      }
    }
  }
  return { sent, failed, devices: tokens.length };
}
