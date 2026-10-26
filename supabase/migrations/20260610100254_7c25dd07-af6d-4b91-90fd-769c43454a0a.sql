
-- Remove overly broad UPDATE policy on siswa (lets students overwrite password_login etc.)
-- PIN changes are performed server-side via service_role in changeMyPin server function.
DROP POLICY IF EXISTS "Siswa update own pin" ON public.siswa;

-- Lock down pin_lockout writes: only service_role (bypasses RLS) should mutate.
-- Add explicit RESTRICTIVE deny policies for INSERT/UPDATE/DELETE by anon/authenticated.
DROP POLICY IF EXISTS "Deny client writes to pin_lockout" ON public.pin_lockout;
CREATE POLICY "Deny client writes to pin_lockout"
ON public.pin_lockout
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
