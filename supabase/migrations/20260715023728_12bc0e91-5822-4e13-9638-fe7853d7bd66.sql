
-- Tambah role 'ortu' pada enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ortu';

-- Tabel hubungan ortu <-> siswa
CREATE TABLE IF NOT EXISTS public.ortu_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ortu_user_id uuid NOT NULL,
  siswa_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ortu_user_id, siswa_user_id)
);
GRANT SELECT ON public.ortu_link TO authenticated;
GRANT ALL ON public.ortu_link TO service_role;
ALTER TABLE public.ortu_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ortu lihat link sendiri"
  ON public.ortu_link FOR SELECT
  TO authenticated
  USING (ortu_user_id = auth.uid());

-- Tabel OTP sementara untuk login ortu
CREATE TABLE IF NOT EXISTS public.ortu_otp (
  no_hp text PRIMARY KEY,
  kode text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ortu_otp TO service_role;
ALTER TABLE public.ortu_otp ENABLE ROW LEVEL SECURITY;
-- (Tidak ada policy untuk authenticated/anon → hanya service_role via server functions.)
