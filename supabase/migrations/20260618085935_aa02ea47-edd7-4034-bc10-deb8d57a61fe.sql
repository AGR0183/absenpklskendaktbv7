ALTER TABLE public.wa_schedule_settings
  ADD COLUMN IF NOT EXISTS fonnte_token TEXT,
  ADD COLUMN IF NOT EXISTS fonnte_sender TEXT;