-- Index untuk query yang paling sering dipakai (rekap harian, riwayat siswa, rekap global)
CREATE INDEX IF NOT EXISTS attendance_tanggal_idx ON public.attendance (tanggal);
CREATE INDEX IF NOT EXISTS attendance_user_waktu_idx ON public.attendance (user_id, waktu DESC);
CREATE INDEX IF NOT EXISTS attendance_waktu_idx ON public.attendance (waktu DESC);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);
