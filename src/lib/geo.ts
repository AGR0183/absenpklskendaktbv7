export type GeoPos = { lat: number; lng: number; accuracy: number };

const CACHE_KEY = "lastKnownGeoPos";

function saveCache(pos: GeoPos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...pos, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

function loadCache(): GeoPos | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat !== "number" || typeof v?.lng !== "number") return null;
    return { lat: v.lat, lng: v.lng, accuracy: v.accuracy ?? 9999 };
  } catch {
    return null;
  }
}

export function getCurrentPosition(): Promise<GeoPos> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      const cached = loadCache();
      if (cached) return resolve(cached);
      reject(new Error("GPS tidak didukung di perangkat ini."));
      return;
    }
    const ok = (pos: GeolocationPosition) => {
      const out: GeoPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      saveCache(out);
      resolve(out);
    };

    // Optimized single call: high-accuracy hardware GPS, 5-min cache, 10s timeout.
    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        // Fallback ke lokasi terakhir yang diketahui jika tersedia.
        const cached = loadCache();
        if (cached) return resolve(cached);
        reject(
          new Error(
            err?.message ||
              "GPS tidak merespons. Pastikan layanan lokasi aktif dan izin diberikan.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "id" } }
    );
    if (!res.ok) return "Lokasi tidak diketahui";
    const data = await res.json();
    return data.display_name || "Lokasi tidak diketahui";
  } catch {
    return "Lokasi tidak diketahui";
  }
}