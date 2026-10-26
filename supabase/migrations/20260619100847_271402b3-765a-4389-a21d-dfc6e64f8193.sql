-- Drop guru/admin blanket SELECT on profiles (exposes phones + pin)
DROP POLICY IF EXISTS "Guru and admin read all profiles" ON public.profiles;

-- Safe view for guru/admin to browse students (no pin, no phone numbers)
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, nama_siswa, kelas, tempat_magang, created_at, updated_at
FROM public.profiles;

REVOKE ALL ON public.profiles_safe FROM PUBLIC;
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Revoke pin column SELECT from clients; only service_role (server admin) can read it
REVOKE SELECT (pin) ON public.profiles FROM authenticated;
REVOKE SELECT (pin) ON public.profiles FROM anon;

-- Harden siswa: pin and password_login are credentials, not for clients
REVOKE SELECT (pin, password_login) ON public.siswa FROM authenticated;
REVOKE SELECT (pin, password_login) ON public.siswa FROM anon;