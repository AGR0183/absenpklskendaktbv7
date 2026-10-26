-- 1) Tambah kolom nomor HP di profiles
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
