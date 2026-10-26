import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Home, History, User, Users, Shield, ClipboardList, Baby, Building2, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, session, profile, isStaff, isGuruOnly, isAdmin, isOrtu, isDudi } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    // Ortu: hanya boleh akses halaman ortu
    if (isOrtu) {
      if (!location.pathname.startsWith("/ortu")) {
        navigate({ to: "/ortu" });
      }
      return;
    }
    // DUDI: hanya boleh akses halaman dudi atau rekap siswa
    if (isDudi) {
      if (
        !location.pathname.startsWith("/dudi") &&
        !location.pathname.startsWith("/rekap")
      ) {
        navigate({ to: "/dudi" });
      }
      return;
    }
    // Guru pembimbing: hanya boleh akses halaman rekap
    if (isGuruOnly) {
      navigate({ to: "/rekap-semua" });
      return;
    }
    // Admin/staff tidak perlu lengkapi data siswa
    if (isStaff) {
      if (location.pathname === "/setup-profil") {
        navigate({ to: isAdmin ? "/admin" : "/beranda" });
      }
      return;
    }
    // Force profile completion (khusus siswa)
    if (
      session &&
      location.pathname !== "/setup-profil" &&
      (!profile?.nama_siswa || !profile?.kelas || !profile?.tempat_magang)
    ) {
      navigate({ to: "/setup-profil" });
    }
  }, [loading, session, profile, location.pathname, navigate, isGuruOnly, isOrtu, isDudi, isStaff, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Memuat…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <main className="flex-1">
        <Outlet />
      </main>
      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-border z-40">
        <div className="max-w-md mx-auto flex items-stretch justify-around">
          {!isGuruOnly && !isOrtu && !isDudi && (
            <>
              {!isStaff && (
                <>
                  <NavItem to="/beranda" icon={<Home className="w-5 h-5" />} label="Beranda" />
                  <NavItem to="/riwayat" icon={<History className="w-5 h-5" />} label="Riwayat" />
                  <NavItem to="/sertifikat" icon={<Award className="w-5 h-5" />} label="Sertifikat" />
                  <NavItem to="/profil" icon={<User className="w-5 h-5" />} label="Profil" />
                </>
              )}
              {isStaff && (
                <NavItem to="/guru" icon={<Users className="w-5 h-5" />} label="Rekap" />
              )}
              {isAdmin && (
                <NavItem to="/admin" icon={<Shield className="w-5 h-5" />} label="Admin" />
              )}
              {isAdmin && (
                <NavItem to="/sertifikat-admin" icon={<Award className="w-5 h-5" />} label="Sertifikat" />
              )}
            </>
          )}
          {isGuruOnly && (
            <NavItem to="/rekap-semua" icon={<ClipboardList className="w-5 h-5" />} label="Rekap Absen" />
          )}
          {isOrtu && (
            <NavItem to="/ortu" icon={<Baby className="w-5 h-5" />} label="Anak Saya" />
          )}
          {isDudi && (
            <NavItem to="/dudi" icon={<Building2 className="w-5 h-5" />} label="Rekap Absen" />
          )}
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex-1 flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground"
      activeProps={{ className: "flex-1 flex flex-col items-center gap-1 py-2.5 text-xs text-primary font-semibold" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}