
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
