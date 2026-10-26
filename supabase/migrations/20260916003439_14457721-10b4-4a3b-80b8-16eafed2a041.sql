CREATE OR REPLACE FUNCTION public.export_auth_users(_offset int, _limit int)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(jsonb_agg(u), '[]'::jsonb) FROM (
    SELECT id, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at,
           raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
           last_sign_in_at, banned_until, is_sso_user, is_anonymous
    FROM auth.users
    ORDER BY created_at, id
    OFFSET _offset LIMIT _limit
  ) u;
$$;

REVOKE ALL ON FUNCTION public.export_auth_users(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_auth_users(int, int) TO service_role;