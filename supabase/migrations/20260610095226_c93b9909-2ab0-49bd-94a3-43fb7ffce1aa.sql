
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
