CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  price_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NPR',
  period text NOT NULL DEFAULT 'month',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_highlighted boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  cta_label text,
  contact_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true OR private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins insert plans"
  ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update plans"
  ON public.subscription_plans FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete plans"
  ON public.subscription_plans FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (code, name, tagline, price_amount, currency, period, features, is_highlighted, sort_order, cta_label)
VALUES
  ('free', 'Free', 'Try Spinnopal risk-free', 0, 'NPR', 'month',
   '["1 active campaign","Up to 100 spins / month","Basic analytics","Email support"]'::jsonb,
   false, 1, 'Start free'),
  ('pro', 'Pro', 'For growing boutiques', 999, 'NPR', 'month',
   '["Unlimited campaigns","Up to 5,000 spins / month","Custom branding & logo","WhatsApp & email messaging","Priority support"]'::jsonb,
   true, 2, 'Upgrade to Pro'),
  ('business', 'Business', 'For multi-location brands', 2499, 'NPR', 'month',
   '["Everything in Pro","Unlimited spins","Team accounts","Advanced analytics & exports","Dedicated account manager"]'::jsonb,
   false, 3, 'Contact sales');
