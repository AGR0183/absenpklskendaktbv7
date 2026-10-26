ALTER TABLE public.wa_schedule_settings
  ADD COLUMN IF NOT EXISTS jam_pulang time without time zone NOT NULL DEFAULT '16:00:00',
  ADD COLUMN IF NOT EXISTS aktif_pulang boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS template_pulang text NOT NULL DEFAULT 'Halo {nama},

Anda belum melakukan absensi PULANG PKL hari ini ({tanggal}). Silakan segera melakukan absen pulang.

— Sistem Absen PKL SMKN 2 Kotabaru';

ALTER TABLE public.wa_schedule_overrides
  ADD COLUMN IF NOT EXISTS skip_pulang boolean NOT NULL DEFAULT false;