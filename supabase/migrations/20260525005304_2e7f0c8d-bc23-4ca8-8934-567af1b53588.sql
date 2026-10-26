CREATE TABLE public.siswa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  username text UNIQUE NOT NULL,
  password_login text NOT NULL,
  nama_lengkap text NOT NULL,
  nisn text,
  kelas text,
  tempat_pkl text,
  status_akun text NOT NULL DEFAULT 'aktif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT siswa_status_check CHECK (status_akun IN ('aktif','nonaktif'))
);

ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage siswa"
ON public.siswa
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'guru'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Users read own siswa"
ON public.siswa
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER siswa_updated_at
BEFORE UPDATE ON public.siswa
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_siswa_username ON public.siswa(username);
CREATE INDEX idx_siswa_user_id ON public.siswa(user_id);