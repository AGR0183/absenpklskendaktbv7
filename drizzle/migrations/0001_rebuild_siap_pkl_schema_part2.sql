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

CREATE TABLE public.dudi_akun (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_tempat text NOT NULL UNIQUE,
  pin text NOT NULL DEFAULT '1234',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dudi_akun TO service_role;
ALTER TABLE public.dudi_akun ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage dudi_akun" ON public.dudi_akun FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dudi_akun TO authenticated;
CREATE TRIGGER update_dudi_akun_updated_at BEFORE UPDATE ON public.dudi_akun
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Owner or staff read attendance photos" ON storage.objects;

CREATE POLICY "Owner, staff, ortu or dudi read attendance photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'guru'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'dudi'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.dudi_akun d
        JOIN public.profiles p ON p.tempat_magang = d.nama_tempat
        WHERE d.user_id = auth.uid()
          AND p.id::text = (storage.foldername(name))[1]
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.ortu_link ol
      WHERE ol.ortu_user_id = auth.uid()
        AND ol.siswa_user_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE OR REPLACE FUNCTION public.is_dudi_of_siswa(_dudi uuid, _siswa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dudi_akun d
    JOIN public.profiles p ON p.tempat_magang = d.nama_tempat
    WHERE d.user_id = _dudi AND p.id = _siswa
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_dudi_of_siswa(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Owner, staff, ortu or dudi read attendance photos" ON storage.objects;

CREATE POLICY "Owner, staff, ortu or dudi read attendance photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'guru'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR public.is_dudi_of_siswa(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.ortu_link ol
      WHERE ol.ortu_user_id = auth.uid()
        AND ol.siswa_user_id::text = (storage.foldername(name))[1]
    )
  )
);

REVOKE EXECUTE ON FUNCTION public.is_dudi_of_siswa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dudi_of_siswa(uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_ortu text NOT NULL DEFAULT '1122';

ALTER TABLE public.wa_schedule_overrides ADD COLUMN IF NOT EXISTS tanggal_libur date[] NOT NULL DEFAULT '{}';

ALTER TABLE public.wa_schedule_settings
  ADD COLUMN IF NOT EXISTS jam_pulang time without time zone NOT NULL DEFAULT '16:00:00',
  ADD COLUMN IF NOT EXISTS aktif_pulang boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS template_pulang text NOT NULL DEFAULT 'Halo {nama},

Anda belum melakukan absensi PULANG PKL hari ini ({tanggal}). Silakan segera melakukan absen pulang.

— Sistem Absen PKL SMKN 2 Kotabaru';

ALTER TABLE public.wa_schedule_overrides
  ADD COLUMN IF NOT EXISTS skip_pulang boolean NOT NULL DEFAULT false;

REVOKE SELECT (pin_ortu) ON public.profiles FROM authenticated;
REVOKE SELECT (pin_ortu) ON public.profiles FROM anon;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_jenis_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_jenis_check CHECK (jenis IN ('masuk','pulang','izin','sakit','peringatan','sp1','sp2','sp3'));

CREATE OR REPLACE FUNCTION public.export_auth_users(_offset int, _limit int)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(jsonb_agg(u), '[]'::jsonb) FROM (
    SELECT id, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at,
           raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
           last_sign_in_at, banned_until, is_sso_user, is_anonymous
    FROM auth.users
    ORDER BY created_at, id
    OFFSET _offset LIMIT _limit
  ) u;
$$;

REVOKE ALL ON FUNCTION public.export_auth_users(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_auth_users(int, int) TO service_role;