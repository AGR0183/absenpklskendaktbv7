import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Scheduled cleanup: delete attendance photos older than 30 days from
 * Supabase Storage and null out `photo_url`. The attendance record itself
 * (date, time, GPS, location name) stays intact for reporting.
 */
export const Route = createFileRoute("/api/public/hooks/cleanup-photos")({
  server: {
    handlers: {
      POST: async () => {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: rows, error: selErr } = await supabaseAdmin
          .from("attendance")
          .select("id, photo_url")
          .lt("created_at", cutoff)
          .not("photo_url", "is", null)
          .limit(1000);

        if (selErr) {
          return new Response(JSON.stringify({ error: selErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!rows || rows.length === 0) {
          return new Response(JSON.stringify({ deleted: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // photo_url is either a legacy public URL containing "/attendance-photos/<path>"
        // or, since the bucket was made private, the bare storage path itself.
        const marker = "/attendance-photos/";
        const paths: string[] = [];
        const ids: string[] = [];
        for (const r of rows) {
          if (!r.photo_url) continue;
          const idx = r.photo_url.indexOf(marker);
          if (idx >= 0) {
            paths.push(r.photo_url.substring(idx + marker.length));
          } else if (!/^https?:\/\//i.test(r.photo_url)) {
            paths.push(r.photo_url);
          } else {
            continue;
          }
          ids.push(r.id);
        }

        if (paths.length > 0) {
          const { error: rmErr } = await supabaseAdmin.storage
            .from("attendance-photos")
            .remove(paths);
          if (rmErr) {
            console.error("[cleanup-photos] storage remove failed", rmErr);
          }
        }

        const { error: updErr } = await supabaseAdmin
          .from("attendance")
          .update({ photo_url: null })
          .in("id", ids);

        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ deleted: paths.length, cutoff }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});