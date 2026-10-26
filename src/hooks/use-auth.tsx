import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "siswa" | "guru" | "admin" | "ortu" | "dudi";

export type Profile = {
  id: string;
  nama_siswa: string | null;
  kelas: string | null;
  tempat_magang: string | null;
  no_hp_siswa: string | null;
  no_hp_ortu: string | null;
  no_hp_guru: string | null;
  no_hp_dudi: string | null;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isStaff: boolean; // guru atau admin
  isAdmin: boolean;
  isGuruOnly: boolean; // role guru tapi bukan admin
  isOrtu: boolean;
  isDudi: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProfileAndRoles(uid: string) {
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,nama_siswa,kelas,tempat_magang,no_hp_siswa,no_hp_ortu,no_hp_guru,no_hp_dudi").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile) ?? null);
    setRoles(((r as { role: AppRole }[] | null) ?? []).map((x) => x.role));
  }

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => {
          loadProfileAndRoles(s.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfileAndRoles(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    loading,
    session,
    user,
    profile,
    roles,
    isStaff: roles.includes("guru") || roles.includes("admin"),
    isAdmin: roles.includes("admin"),
    isGuruOnly: roles.includes("guru") && !roles.includes("admin"),
    isOrtu: roles.includes("ortu"),
    isDudi: roles.includes("dudi"),
    refresh: async () => {
      if (user) await loadProfileAndRoles(user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}