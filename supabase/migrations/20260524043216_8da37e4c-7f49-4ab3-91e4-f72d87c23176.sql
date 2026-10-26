ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_jenis_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_jenis_check CHECK (jenis IN ('masuk','pulang','izin','sakit'));