-- Pending signups table: stores signup requests awaiting admin approval.
-- Password is stored temporarily so admin can create the auth account on approval.
-- Locked down: only service_role can read/write (server functions). RLS denies all to anon/authenticated.
CREATE TABLE public.pending_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pending_signups_email_pending_idx
  ON public.pending_signups (lower(email)) WHERE status = 'pending';
CREATE INDEX pending_signups_status_idx ON public.pending_signups (status, created_at DESC);

GRANT ALL ON public.pending_signups TO service_role;
-- No grants to anon/authenticated: all access goes through server functions using service role.

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Deny-by-default. Service role bypasses RLS automatically.
CREATE POLICY "no direct access" ON public.pending_signups FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE TRIGGER update_pending_signups_updated_at
  BEFORE UPDATE ON public.pending_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();