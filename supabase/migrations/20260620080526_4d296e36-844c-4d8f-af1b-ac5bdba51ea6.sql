
-- Re-assert: anon must never have table-level SELECT on shops (only column-level on safe columns)
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO authenticated;

-- Stable public-safe view that structurally cannot expose owner_user_id
CREATE OR REPLACE VIEW public.shops_public
WITH (security_invoker = true) AS
SELECT id, name, slug, logo_url, is_active, created_at, updated_at
FROM public.shops
WHERE is_active = true;

GRANT SELECT ON public.shops_public TO anon, authenticated;
