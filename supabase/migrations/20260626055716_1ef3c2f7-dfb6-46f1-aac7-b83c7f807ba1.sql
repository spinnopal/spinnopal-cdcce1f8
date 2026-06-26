-- Re-add public read policy (RLS gate) — column exposure is controlled by GRANTs below
CREATE POLICY "Public read active shops" ON public.shops
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Column-level grants: only safe columns readable by anon/authenticated on the base table
REVOKE SELECT ON public.shops FROM anon, authenticated;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at)
  ON public.shops TO anon, authenticated;

-- Owners and super admins still need full column SELECT via their policies; that flows
-- through column grants too, so grant remaining columns to authenticated only when
-- queried by owner/admin policies. Easiest: grant full SELECT to authenticated, since
-- non-owner authenticated users are blocked by RLS from non-owned rows for sensitive use,
-- but to keep parity with anon we instead require owners/admins to read via server fns
-- using the service role (already the case in shops.functions.ts). So we keep the
-- restricted column grant for authenticated as well.

-- Make the view enforce caller permissions (linter requirement)
ALTER VIEW public.shops_public SET (security_invoker = true);