
-- Enums
DO $$ BEGIN
  CREATE TYPE public.shop_plan AS ENUM ('free','pro','lifetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_sub_status AS ENUM ('trial','active','past_due','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS plan public.shop_plan NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status public.shop_sub_status NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_notes text;

-- Make sure anon can still read the safe public columns (including new ones used for status display)
GRANT SELECT (id, name, slug, logo_url, is_active, plan, subscription_status, trial_ends_at, current_period_end)
  ON public.shops TO anon;
GRANT SELECT (id, name, slug, logo_url, is_active, plan, subscription_status, trial_ends_at, current_period_end, owner_user_id, created_at, updated_at, billing_notes)
  ON public.shops TO authenticated;

-- Payment log (manual records you enter as super-admin)
CREATE TABLE IF NOT EXISTS public.shop_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NPR',
  method text,
  reference text,
  period_start timestamptz,
  period_end timestamptz,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_payments TO authenticated;
GRANT ALL ON public.shop_payments TO service_role;

ALTER TABLE public.shop_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own payments" ON public.shop_payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_payments.shop_id AND s.owner_user_id = auth.uid()));

CREATE POLICY "Super admins manage payments" ON public.shop_payments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_shop_payments_shop ON public.shop_payments(shop_id, created_at DESC);
