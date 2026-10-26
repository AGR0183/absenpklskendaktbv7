import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/logo-smkn2.png";
import doa from "@/assets/doa.png";
import safety from "@/assets/safety-first.png";
import { useAuth } from "@/hooks/use-auth";
import { getDailyQuote } from "@/lib/quotes";

export const Route = createFileRoute("/")({
  component: SplashPage,
});

function SplashPage() {
  const navigate = useNavigate();
  const { loading, session, isAdmin, isGuruOnly, isOrtu, isDudi } = useAuth();
  const [show, setShow] = useState(true);
  const [quote, setQuote] = useState<ReturnType<typeof getDailyQuote> | null>(null);

  useEffect(() => {
    setQuote(getDailyQuote());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (show || loading) return;
    if (session)
      navigate({
        to: isOrtu ? "/ortu" : isDudi ? "/dudi" : isAdmin ? "/admin" : isGuruOnly ? "/rekap-semua" : "/beranda",
      });
    else navigate({ to: "/login" });
  }, [show, loading, session, navigate, isAdmin, isGuruOnly, isOrtu, isDudi]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 text-center"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div className="pt-10 flex flex-col items-center gap-3">
        <img src={logo} alt="Logo SMKN 2 Kotabaru" className="w-28 h-28 object-contain drop-shadow-lg" />
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground leading-tight">
          SIAP PKL
        </h1>
        <p className="text-[10px] font-medium text-primary text-center max-w-[260px] leading-snug">
          Sistem Informasi Absensi dan Pemantauan
          <br />
          Praktik Kerja Lapangan
        </p>
        <p className="text-sm font-semibold text-primary">SMK Negeri 2 Kotabaru</p>
      </div>

      <div className="flex flex-col items-center gap-6 my-8">
        <div className="flex items-end gap-8">
          <div className="flex flex-col items-center">
            <img src={doa} alt="Berdoa sebelum bekerja" className="w-28 h-28 object-contain" />
            <span className="mt-2 text-xs font-semibold text-secondary">Berdoa</span>
          </div>
          <div className="flex flex-col items-center">
            <img src={safety} alt="Safety First" className="w-28 h-28 object-contain" />
            <span className="mt-2 text-xs font-semibold text-success">Safety First</span>
          </div>
        </div>
        <div className="max-w-xs flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold tracking-wide uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Kata-kata hari ini{quote ? ` — ${quote.category}` : ""}
          </span>
          <p className="text-sm text-foreground italic leading-relaxed">
            {quote ? `"${quote.text}"` : ""}
          </p>
        </div>
      </div>

      <div className="pb-6 flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "120ms" }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "240ms" }} />
        </div>
        <p className="text-xs text-muted-foreground">Memuat aplikasi…</p>
        {!loading && !show && (
          <Link to="/login" className="text-xs text-primary underline mt-1">Lanjutkan</Link>
        )}
      </div>
    </div>
  );
}