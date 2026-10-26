
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
