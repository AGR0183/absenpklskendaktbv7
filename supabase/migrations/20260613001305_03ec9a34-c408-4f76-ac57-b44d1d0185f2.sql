ALTER TABLE public.wa_schedule_overrides ADD COLUMN IF NOT EXISTS hari_aktif integer[] NULL;

-- Allow siswa to view & upsert their own override row
DROP POLICY IF EXISTS "Siswa kelola override sendiri" ON public.wa_schedule_overrides;
CREATE POLICY "Siswa kelola override sendiri"
ON public.wa_schedule_overrides
FOR ALL
TO authenticated
USING (siswa_user_id = auth.uid())
WITH CHECK (siswa_user_id = auth.uid());