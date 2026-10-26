
-- Fix 1: Drop student SELECT policy on siswa (exposes plaintext password_login).
-- All app-side reads of siswa go through server functions using the service role,
-- so client-side access is unnecessary.
DROP POLICY IF EXISTS "Users read own siswa" ON public.siswa;

-- Defense-in-depth: revoke client access to plaintext credential columns.
REVOKE SELECT (password_login, pin) ON public.siswa FROM authenticated, anon;

-- Fix 2: Prevent guru/admin (and any authenticated user) from reading the
-- profiles.pin column via the Data API. Service role bypasses column grants,
-- so server-side PIN verification (auth-pin.functions.ts) still works.
REVOKE SELECT (pin) ON public.profiles FROM authenticated, anon;
