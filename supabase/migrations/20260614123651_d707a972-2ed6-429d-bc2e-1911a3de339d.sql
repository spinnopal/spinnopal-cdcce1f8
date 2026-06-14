
CREATE TABLE public.access_codes (
  code text PRIMARY KEY,
  is_used boolean NOT NULL DEFAULT false,
  spun_at timestamptz,
  prize_won text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.access_codes TO service_role;

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (server functions) may touch this table.
CREATE INDEX idx_access_codes_created_at ON public.access_codes (created_at DESC);
