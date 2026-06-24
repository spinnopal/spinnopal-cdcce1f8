-- Harden public exposure: anonymous visitors must never read owner_user_id from shops.
-- 1. Drop the table-level public read policy on shops; public access goes through the safe view.
DROP POLICY IF EXISTS "Public read active shops" ON public.shops;

-- 2. Make shops_public a security-definer view so callers don't need direct grants on shops.
ALTER VIEW public.shops_public SET (security_invoker = false);

-- 3. Grant read on the safe view to anonymous and authenticated roles.
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- 4. Defensive: ensure anon has no SELECT on the base shops table.
REVOKE SELECT ON public.shops FROM anon;