
-- 1) profiles.pin: remove from Data API read for non-admins.
-- Strategy: revoke broad table-level SELECT on profiles from authenticated,
-- then grant SELECT only on non-sensitive columns. Admin/server code uses service_role.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, nama_siswa, kelas, tempat_magang, no_hp_siswa, no_hp_ortu, no_hp_guru, no_hp_dudi, created_at, updated_at)
  ON public.profiles TO authenticated;
-- keep INSERT/UPDATE table-wide so users can still upsert their own profile (RLS still applies)

-- 2) siswa.password_login: hide from authenticated; admin uses service_role.
REVOKE SELECT ON public.siswa FROM authenticated;
GRANT SELECT (id, user_id, nama_lengkap, nisn, username, kelas, tempat_pkl, pin, status_akun, created_at, updated_at)
  ON public.siswa TO authenticated;

-- 3) siswa update: students should only be able to update their own pin.
-- Revoke broad UPDATE and grant only UPDATE(pin) at column level for authenticated.
-- Admin updates run through service_role (supabaseAdmin) which bypasses these grants.
REVOKE UPDATE ON public.siswa FROM authenticated;
GRANT UPDATE (pin) ON public.siswa TO authenticated;

-- Ensure service_role retains full access for admin server code.
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.siswa TO service_role;
