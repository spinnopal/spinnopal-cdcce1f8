DROP POLICY IF EXISTS "Public read active shops" ON public.shops;
CREATE POLICY "Public read active shops" ON public.shops
  FOR SELECT TO anon
  USING (is_active = true);