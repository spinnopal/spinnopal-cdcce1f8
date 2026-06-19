
-- 1) Lock down access_codes: only service_role may read/write. Owners access via server fns.
DROP POLICY IF EXISTS "Owners manage their codes" ON public.access_codes;
DROP POLICY IF EXISTS "Super admins manage all codes" ON public.access_codes;
REVOKE ALL ON public.access_codes FROM anon, authenticated;
GRANT ALL ON public.access_codes TO service_role;

-- 2) Hide owner_user_id from anon on shops via column-level GRANTs.
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO anon;

-- 3) Prevent super_admin self-promotion via authenticated INSERT/UPDATE.
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
-- Keep "Users view own roles" and "Super admins view all roles" for reads.
-- All writes must go through service_role (server-side, via bootstrap or admin server fns).
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

-- 4) Limit has_role EXECUTE to authenticated only (not anon/public).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
