import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "attendance-photos";
const MARKER = "/attendance-photos/";

/**
 * Accepts either a legacy public URL (containing "/attendance-photos/<path>")
 * or a plain storage path ("<userId>/<file>") and returns the storage path.
 */
export function extractPhotoPath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const i = urlOrPath.indexOf(MARKER);
  if (i >= 0) return urlOrPath.substring(i + MARKER.length);
  if (/^https?:\/\//i.test(urlOrPath)) return null;
  return urlOrPath;
}

/**
 * Cache URL bertanda tangan agar satu foto tidak ditandatangani berulang kali
 * saat komponen dirender ulang atau dibuka kembali.
 */
const signedCache = new Map<string, { url: string; exp: number }>();

export async function getPhotoSignedUrl(
  urlOrPath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  const path = extractPhotoPath(urlOrPath);
  if (!path) return null;

  const cached = signedCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  signedCache.set(path, {
    url: data.signedUrl,
    // beri jeda 60 detik sebelum kedaluwarsa
    exp: Date.now() + (expiresIn - 60) * 1000,
  });
  return data.signedUrl;
}

/**
 * React hook: resolves a stored photo reference to a usable signed URL.
 * `enabled = false` menunda permintaan sampai foto benar-benar dibutuhkan
 * (mis. saat thumbnail masuk layar atau tombol "Lihat Foto" ditekan).
 */
export function usePhotoUrl(
  urlOrPath: string | null | undefined,
  enabled = true,
): string | null {
  const path = extractPhotoPath(urlOrPath);
  const cachedNow = path ? signedCache.get(path) : undefined;
  const [url, setUrl] = useState<string | null>(
    cachedNow && cachedNow.exp > Date.now() ? cachedNow.url : null,
  );
  useEffect(() => {
    let cancelled = false;
    if (!urlOrPath || !enabled) return;
    getPhotoSignedUrl(urlOrPath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [urlOrPath, enabled]);
  return url;
}
