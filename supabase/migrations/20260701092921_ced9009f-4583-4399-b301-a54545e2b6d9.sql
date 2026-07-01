
CREATE INDEX IF NOT EXISTS prizes_shop_sort_idx ON public.prizes (shop_id, sort_order);
CREATE INDEX IF NOT EXISTS prizes_shop_campaign_sort_idx ON public.prizes (shop_id, campaign_id, sort_order);
CREATE INDEX IF NOT EXISTS campaigns_shop_default_idx ON public.campaigns (shop_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS access_codes_shop_active_idx ON public.access_codes (shop_id, is_used) WHERE is_used = false;
