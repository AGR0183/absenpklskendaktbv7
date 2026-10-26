-- Allow photo_url to be null so cleanup can mark deleted photos while keeping attendance record
ALTER TABLE public.attendance ALTER COLUMN photo_url DROP NOT NULL;

-- Enable extensions needed for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;