DROP POLICY IF EXISTS "Owner or staff read attendance photos" ON storage.objects;

CREATE POLICY "Owner, staff, ortu or dudi read attendance photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'guru'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'dudi'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.dudi_akun d
        JOIN public.profiles p ON p.tempat_magang = d.nama_tempat
        WHERE d.user_id = auth.uid()
          AND p.id::text = (storage.foldername(name))[1]
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.ortu_link ol
      WHERE ol.ortu_user_id = auth.uid()
        AND ol.siswa_user_id::text = (storage.foldername(name))[1]
    )
  )
);