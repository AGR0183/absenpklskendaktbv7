CREATE OR REPLACE FUNCTION public.is_dudi_of_siswa(_dudi uuid, _siswa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dudi_akun d
    JOIN public.profiles p ON p.tempat_magang = d.nama_tempat
    WHERE d.user_id = _dudi AND p.id = _siswa
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_dudi_of_siswa(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "Owner, staff, ortu or dudi read attendance photos" ON storage.objects;

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
    OR public.is_dudi_of_siswa(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.ortu_link ol
      WHERE ol.ortu_user_id = auth.uid()
        AND ol.siswa_user_id::text = (storage.foldername(name))[1]
    )
  )
);