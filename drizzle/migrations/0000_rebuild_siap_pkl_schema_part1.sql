
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('siswa', 'guru', 'admin');
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ortu';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dudi';

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_siswa text,
  kelas text,
  tempat_magang text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jenis text NOT NULL CHECK (jenis IN ('masuk', 'pulang')),
  tanggal date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Makassar')::date,
  waktu timestamptz NOT NULL DEFAULT now(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  nama_lokasi text,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tanggal, jenis)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + assign default 'siswa' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_siswa, kelas, tempat_magang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_siswa', ''),
    COALESCE(NEW.raw_user_meta_data->>'kelas', ''),
    COALESCE(NEW.raw_user_meta_data->>'tempat_magang', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'siswa');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Guru and admin read all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

-- RLS: attendance
CREATE POLICY "Users read own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Guru and admin read all attendance" ON public.attendance
  FOR SELECT USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

-- RLS: user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin read all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view attendance photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'attendance-photos');
CREATE POLICY "Authenticated users upload own attendance photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attendance-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger functions should not be callable by anyone via API
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- has_role: only signed-in users need it (used in RLS but RLS evaluates as the row owner, not the caller's grant)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- Allow photo_url to be null so cleanup can mark deleted photos while keeping attendance record
ALTER TABLE public.attendance ALTER COLUMN photo_url DROP NOT NULL;

-- Enable extensions needed for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;ALTER TABLE public.attendance ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN longitude DROP NOT NULL;ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_jenis_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_jenis_check CHECK (jenis IN ('masuk','pulang','izin','sakit'));CREATE TABLE public.siswa (
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
CREATE INDEX idx_siswa_user_id ON public.siswa(user_id);-- 1) Tambah kolom nomor HP di profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS no_hp_siswa text,
  ADD COLUMN IF NOT EXISTS no_hp_ortu  text,
  ADD COLUMN IF NOT EXISTS no_hp_guru  text,
  ADD COLUMN IF NOT EXISTS no_hp_dudi  text;

-- 2) Update trigger handle_new_user agar nomor HP ikut tersimpan saat akun dibuat
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, nama_siswa, kelas, tempat_magang,
    no_hp_siswa, no_hp_ortu, no_hp_guru, no_hp_dudi
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_siswa', ''),
    COALESCE(NEW.raw_user_meta_data->>'kelas', ''),
    COALESCE(NEW.raw_user_meta_data->>'tempat_magang', ''),
    NULLIF(NEW.raw_user_meta_data->>'no_hp_siswa', ''),
    NULLIF(NEW.raw_user_meta_data->>'no_hp_ortu',  ''),
    NULLIF(NEW.raw_user_meta_data->>'no_hp_guru',  ''),
    NULLIF(NEW.raw_user_meta_data->>'no_hp_dudi',  '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'siswa');
  RETURN NEW;
END;
$function$;

-- 3) Tabel log pengingat WhatsApp otomatis
CREATE TABLE IF NOT EXISTS public.wa_reminder_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tanggal date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Makassar')::date),
  tahap text NOT NULL CHECK (tahap IN ('siswa','ortu','dudi','guru')),
  status text NOT NULL DEFAULT 'sent',
  detail text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tanggal, tahap)
);

GRANT SELECT ON public.wa_reminder_log TO authenticated;
GRANT ALL    ON public.wa_reminder_log TO service_role;

ALTER TABLE public.wa_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read wa reminder log"
  ON public.wa_reminder_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Add UPDATE/DELETE policies for attendance-photos (restrict to owner folder)
CREATE POLICY "Users update own attendance photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own attendance photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2. Prevent listing all files in the public bucket; public URLs still serve images.
DROP POLICY IF EXISTS "Anyone can view attendance photos" ON storage.objects;

-- Allow owner + staff to query their own objects via the API (does not affect public URL serving)
CREATE POLICY "Owner or staff read attendance photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'guru'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3. Restrict siswa table (contains plaintext password_login) to admins only via Data API.
-- Guru does not need direct table access — they read student info through profiles.
-- Admin UI uses service_role (supabaseAdmin) which bypasses RLS, so listing keeps working.
DROP POLICY IF EXISTS "Staff manage siswa" ON public.siswa;

CREATE POLICY "Admin manage siswa"
ON public.siswa
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS pin TEXT NOT NULL DEFAULT '1234';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin TEXT NOT NULL DEFAULT '1234';

UPDATE public.siswa SET pin = CASE WHEN password_login ~ '^[0-9]{4,6}$' THEN password_login ELSE '1234' END WHERE pin = '1234';

CREATE TABLE IF NOT EXISTS public.wa_schedule_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  jam_siswa TIME NOT NULL DEFAULT '07:30',
  jam_ortu TIME NOT NULL DEFAULT '08:00',
  jam_dudi TIME NOT NULL DEFAULT '08:30',
  jam_guru TIME NOT NULL DEFAULT '09:00',
  aktif_siswa BOOLEAN NOT NULL DEFAULT TRUE,
  aktif_ortu BOOLEAN NOT NULL DEFAULT TRUE,
  aktif_dudi BOOLEAN NOT NULL DEFAULT TRUE,
  aktif_guru BOOLEAN NOT NULL DEFAULT TRUE,
  template_siswa TEXT NOT NULL DEFAULT E'Halo {nama},\n\nAnda belum melakukan absensi PKL hari ini ({tanggal}). Silakan segera melakukan absensi atau memberikan konfirmasi.\n\n— Sistem Absen PKL SMKN 2 Kotabaru',
  template_ortu TEXT NOT NULL DEFAULT E'Yth. Orang Tua/Wali {nama},\nAnanda belum melakukan absensi PKL hari ini ({tanggal}). Mohon dibantu pengingatannya.\n\n— Sistem Absen PKL SMKN 2 Kotabaru',
  template_dudi TEXT NOT NULL DEFAULT E'Yth. Pembimbing DUDI {tempat},\nSiswa PKL a.n. {nama} ({kelas}) belum melakukan absensi hari ini ({tanggal}). Mohon konfirmasi keberadaan siswa.\n\n— Sistem Absen PKL SMKN 2 Kotabaru',
  template_guru TEXT NOT NULL DEFAULT E'Yth. Bapak/Ibu Guru,\nRingkasan siswa belum absen PKL hari ini ({tanggal}):\n\n{daftar}\n\n— Sistem Absen PKL SMKN 2 Kotabaru',
  hari_aktif INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wa_schedule_settings TO authenticated;
GRANT ALL ON public.wa_schedule_settings TO service_role;
ALTER TABLE public.wa_schedule_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read wa settings" ON public.wa_schedule_settings;
CREATE POLICY "Admins read wa settings" ON public.wa_schedule_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.wa_schedule_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.wa_schedule_overrides (
  siswa_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  disable_all BOOLEAN NOT NULL DEFAULT FALSE,
  skip_siswa BOOLEAN NOT NULL DEFAULT FALSE,
  skip_ortu BOOLEAN NOT NULL DEFAULT FALSE,
  skip_dudi BOOLEAN NOT NULL DEFAULT FALSE,
  skip_guru BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wa_schedule_overrides TO authenticated;
GRANT ALL ON public.wa_schedule_overrides TO service_role;
ALTER TABLE public.wa_schedule_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read wa overrides" ON public.wa_schedule_overrides;
CREATE POLICY "Admins read wa overrides" ON public.wa_schedule_overrides FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Siswa update own pin" ON public.siswa;
CREATE POLICY "Siswa update own pin" ON public.siswa FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.wa_reminder_log TO authenticated;
GRANT ALL ON public.wa_reminder_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_schedule_settings TO authenticated;
GRANT ALL ON public.wa_schedule_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_schedule_overrides TO authenticated;
GRANT ALL ON public.wa_schedule_overrides TO service_role;
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

-- PIN lockout tracking
CREATE TABLE IF NOT EXISTS public.pin_lockout (
  user_id UUID PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.pin_lockout TO service_role;
ALTER TABLE public.pin_lockout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin can read" ON public.pin_lockout FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- WA reminder cron jobs (WITA = UTC+8). Schedule in UTC.
-- 07:30 WITA = 23:30 UTC (prev day)
-- 08:00 WITA = 00:00 UTC
-- 08:30 WITA = 00:30 UTC
-- 09:00 WITA = 01:00 UTC
DO $$
DECLARE
  base_headers TEXT := '{"Content-Type":"application/json"}';
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('wa-remind-siswa','wa-remind-ortu','wa-remind-dudi','wa-summary-guru');

  PERFORM cron.schedule('wa-remind-siswa','30 23 * * *',$cmd$
    SELECT net.http_post(
      url:='https://project--3ee385db-2fbf-4f65-89bf-bcaa4d8264ee.lovable.app/api/public/hooks/wa-remind-siswa',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb);
  $cmd$);

  PERFORM cron.schedule('wa-remind-ortu','0 0 * * *',$cmd$
    SELECT net.http_post(
      url:='https://project--3ee385db-2fbf-4f65-89bf-bcaa4d8264ee.lovable.app/api/public/hooks/wa-remind-ortu',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb);
  $cmd$);

  PERFORM cron.schedule('wa-remind-dudi','30 0 * * *',$cmd$
    SELECT net.http_post(
      url:='https://project--3ee385db-2fbf-4f65-89bf-bcaa4d8264ee.lovable.app/api/public/hooks/wa-remind-dudi',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb);
  $cmd$);

  PERFORM cron.schedule('wa-summary-guru','0 1 * * *',$cmd$
    SELECT net.http_post(
      url:='https://project--3ee385db-2fbf-4f65-89bf-bcaa4d8264ee.lovable.app/api/public/hooks/wa-summary-guru',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb);
  $cmd$);
END $$;

-- Remove overly broad UPDATE policy on siswa (lets students overwrite password_login etc.)
-- PIN changes are performed server-side via service_role in changeMyPin server function.
DROP POLICY IF EXISTS "Siswa update own pin" ON public.siswa;

-- Lock down pin_lockout writes: only service_role (bypasses RLS) should mutate.
-- Add explicit RESTRICTIVE deny policies for INSERT/UPDATE/DELETE by anon/authenticated.
DROP POLICY IF EXISTS "Deny client writes to pin_lockout" ON public.pin_lockout;
CREATE POLICY "Deny client writes to pin_lockout"
ON public.pin_lockout
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
ALTER TABLE public.wa_schedule_overrides ADD COLUMN IF NOT EXISTS hari_aktif integer[] NULL;

-- Allow siswa to view & upsert their own override row
DROP POLICY IF EXISTS "Siswa kelola override sendiri" ON public.wa_schedule_overrides;
CREATE POLICY "Siswa kelola override sendiri"
ON public.wa_schedule_overrides
FOR ALL
TO authenticated
USING (siswa_user_id = auth.uid())
WITH CHECK (siswa_user_id = auth.uid());
-- Fix 1: Drop student SELECT policy on siswa (exposes plaintext password_login).
-- All app-side reads of siswa go through server functions using the service role,
-- so client-side access is unnecessary.
DROP POLICY IF EXISTS "Users read own siswa" ON public.siswa;

-- Defense-in-depth: revoke client access to plaintext credential columns.
REVOKE SELECT (password_login, pin) ON public.siswa FROM authenticated, anon;

-- Fix 2: Prevent guru/admin (and any authenticated user) from reading the
-- profiles.pin column via the Data API. Service role bypasses column grants,
-- so server-side PIN verification (auth-pin.functions.ts) still works.
REVOKE SELECT (pin) ON public.profiles FROM authenticated, anon;
ALTER TABLE public.wa_schedule_settings ADD COLUMN IF NOT EXISTS sender_phone TEXT;ALTER TABLE public.wa_schedule_settings
  ADD COLUMN IF NOT EXISTS fonnte_token TEXT,
  ADD COLUMN IF NOT EXISTS fonnte_sender TEXT;ALTER TABLE public.wa_schedule_settings ADD COLUMN IF NOT EXISTS jeda_menit numeric NOT NULL DEFAULT 0;-- Drop guru/admin blanket SELECT on profiles (exposes phones + pin)
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
REVOKE SELECT (pin, password_login) ON public.siswa FROM anon;DROP VIEW IF EXISTS public.profiles_safe;-- Restrict writes on wa_schedule_settings to admins only
CREATE POLICY "Admins insert wa settings" ON public.wa_schedule_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update wa settings" ON public.wa_schedule_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete wa settings" ON public.wa_schedule_settings
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));CREATE TABLE public.guru_favorit_siswa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id uuid NOT NULL,
  siswa_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guru_id, siswa_id)
);

GRANT SELECT, INSERT, DELETE ON public.guru_favorit_siswa TO authenticated;
GRANT ALL ON public.guru_favorit_siswa TO service_role;

ALTER TABLE public.guru_favorit_siswa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guru read own favorites"
  ON public.guru_favorit_siswa FOR SELECT
  TO authenticated
  USING (auth.uid() = guru_id);

CREATE POLICY "Guru insert own favorites"
  ON public.guru_favorit_siswa FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = guru_id
    AND (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Guru delete own favorites"
  ON public.guru_favorit_siswa FOR DELETE
  TO authenticated
  USING (auth.uid() = guru_id);

CREATE INDEX guru_favorit_siswa_guru_idx ON public.guru_favorit_siswa(guru_id);