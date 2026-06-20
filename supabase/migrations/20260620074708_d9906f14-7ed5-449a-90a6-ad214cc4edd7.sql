
-- 1) Restrict anon column access on shops so owner_user_id is never exposed via the Data API
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO anon;

-- 2) Move has_role() out of the public/API schema into a private schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Drop policies that reference public.has_role so we can drop the function
DROP POLICY IF EXISTS "Super admins manage all prizes" ON public.prizes;
DROP POLICY IF EXISTS "Super admins manage all shops" ON public.shops;
DROP POLICY IF EXISTS "Super admins view all roles" ON public.user_roles;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate the super-admin policies using private.has_role
CREATE POLICY "Super admins manage all prizes"
  ON public.prizes
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins manage all shops"
  ON public.shops
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3) Explicit deny-by-default policies on access_codes (all reads/writes go through server functions with the service role)
CREATE POLICY "No direct anon access" ON public.access_codes
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "No direct authenticated access" ON public.access_codes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
