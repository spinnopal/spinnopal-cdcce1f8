-- ============ 1. campaigns table ============
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, slug)
);

CREATE INDEX campaigns_shop_id_idx ON public.campaigns(shop_id);
CREATE INDEX campaigns_shop_active_idx ON public.campaigns(shop_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT ON public.campaigns TO anon;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Owners full control of their shop's campaigns
CREATE POLICY "Owners manage their campaigns"
  ON public.campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = campaigns.shop_id AND s.owner_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = campaigns.shop_id AND s.owner_user_id = auth.uid())
  );

-- Anon can see only active campaigns of active shops (no PII columns are sensitive here)
CREATE POLICY "Public can read active campaigns"
  ON public.campaigns FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM public.shops s
                WHERE s.id = campaigns.shop_id AND COALESCE(s.is_active, true) = true)
  );

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. backfill default campaign for every existing shop ============
INSERT INTO public.campaigns (shop_id, name, slug, is_active, is_default)
SELECT id, 'Main Campaign', 'main', true, true FROM public.shops
ON CONFLICT (shop_id, slug) DO NOTHING;

-- ============ 3. add campaign_id to prizes and access_codes ============
ALTER TABLE public.prizes ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.access_codes ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

UPDATE public.prizes p
SET campaign_id = c.id
FROM public.campaigns c
WHERE c.shop_id = p.shop_id AND c.is_default = true AND p.campaign_id IS NULL;

UPDATE public.access_codes a
SET campaign_id = c.id
FROM public.campaigns c
WHERE c.shop_id = a.shop_id AND c.is_default = true AND a.campaign_id IS NULL;

CREATE INDEX prizes_campaign_id_idx ON public.prizes(campaign_id);
CREATE INDEX access_codes_campaign_id_idx ON public.access_codes(campaign_id);
