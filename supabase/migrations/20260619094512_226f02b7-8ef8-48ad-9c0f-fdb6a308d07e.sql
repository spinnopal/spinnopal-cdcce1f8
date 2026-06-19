
-- 1. Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('super_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 2. Shops table
CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT ON public.shops TO anon;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active shops" ON public.shops
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Owner read own shop" ON public.shops
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owner update own shop" ON public.shops
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Authenticated create owned shop" ON public.shops
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Super admins manage all shops" ON public.shops
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed legacy shop for existing data
INSERT INTO public.shops (id, name, slug, owner_user_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mas Mobile Zone', 'mas-mobile-zone', NULL);

-- 4. Scope prizes to shop
ALTER TABLE public.prizes ADD COLUMN shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE;
UPDATE public.prizes SET shop_id = '00000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL;
ALTER TABLE public.prizes ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.prizes DROP CONSTRAINT prizes_pkey;
ALTER TABLE public.prizes ADD PRIMARY KEY (shop_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prizes TO authenticated;
GRANT SELECT ON public.prizes TO anon;
GRANT ALL ON public.prizes TO service_role;

DROP POLICY IF EXISTS "Public can read prizes" ON public.prizes;
CREATE POLICY "Public read prizes of active shops" ON public.prizes
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = prizes.shop_id AND s.is_active = true));
CREATE POLICY "Owners manage their prizes" ON public.prizes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = prizes.shop_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = prizes.shop_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "Super admins manage all prizes" ON public.prizes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Scope access_codes to shop
ALTER TABLE public.access_codes ADD COLUMN shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE;
UPDATE public.access_codes SET shop_id = '00000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL;
ALTER TABLE public.access_codes ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.access_codes DROP CONSTRAINT access_codes_pkey;
ALTER TABLE public.access_codes ADD PRIMARY KEY (shop_id, code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;

DROP POLICY IF EXISTS "No client access to access_codes" ON public.access_codes;
CREATE POLICY "Owners manage their codes" ON public.access_codes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = access_codes.shop_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = access_codes.shop_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "Super admins manage all codes" ON public.access_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
