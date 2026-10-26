REVOKE EXECUTE ON FUNCTION public.is_dudi_of_siswa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dudi_of_siswa(uuid, uuid) TO authenticated, service_role;