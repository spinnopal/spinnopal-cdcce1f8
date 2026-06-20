CREATE INDEX IF NOT EXISTS idx_shops_owner_user_id ON public.shops (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_shop_spun_at ON public.access_codes (shop_id, spun_at DESC) WHERE spun_at IS NOT NULL;
ANALYZE public.shops;
ANALYZE public.prizes;
ANALYZE public.access_codes;