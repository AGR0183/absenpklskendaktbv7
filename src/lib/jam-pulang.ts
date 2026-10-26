// Aturan jam buka Absen Pulang (WITA / Asia/Makassar)
// Senin–Kamis: mulai 15:00 · Jumat: mulai 10:30 · Sabtu & Minggu: mulai 12:00
export function jamPulangMulai(date: Date = new Date()): { jam: number; menit: number } {
  const hari = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    weekday: "short",
  }).format(date);
  if (hari === "Fri") return { jam: 10, menit: 30 };
  if (hari === "Sat" || hari === "Sun") return { jam: 12, menit: 0 };
  return { jam: 15, menit: 0 };
}

export function labelJamPulang(date: Date = new Date()): string {
  const { jam, menit } = jamPulangMulai(date);
  return `${String(jam).padStart(2, "0")}.${String(menit).padStart(2, "0")} WITA`;
}

export function bolehAbsenPulang(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const { jam, menit } = jamPulangMulai(date);
  return h * 60 + m >= jam * 60 + menit;
}
