-- Remove broad public read policy on shops; restrict public reads to the safe view
DROP POLICY IF EXISTS "Public read active shops" ON public.shops;

-- Ensure the safe view is accessible to anon/authenticated
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- Make the view run as caller (security_invoker) so it inherits RLS-free anon read of the view, not the underlying table
ALTER VIEW public.shops_public SET (security_invoker = false);