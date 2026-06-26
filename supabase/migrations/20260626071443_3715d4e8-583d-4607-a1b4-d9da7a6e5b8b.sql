DROP POLICY IF EXISTS "Public read active shops" ON public.shops;
REVOKE SELECT ON public.shops FROM anon;