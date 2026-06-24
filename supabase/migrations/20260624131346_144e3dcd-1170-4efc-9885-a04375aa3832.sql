-- Use security_invoker so the view respects the caller's RLS + grants.
ALTER VIEW public.shops_public SET (security_invoker = true);

-- Re-add a public read policy on shops, but only for the safe view path:
-- column-level grants below restrict which columns anon/authenticated can actually read.
CREATE POLICY "Public read active shops"
  ON public.shops
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Column-level SELECT grants: anon/authenticated may read only non-sensitive columns.
-- owner_user_id is intentionally excluded.
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at)
  ON public.shops TO anon, authenticated;