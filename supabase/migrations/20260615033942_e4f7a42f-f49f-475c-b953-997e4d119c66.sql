
CREATE TABLE public.prizes (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  image_url text NOT NULL,
  is_win boolean NOT NULL DEFAULT true,
  probability integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prizes TO anon, authenticated;
GRANT ALL ON public.prizes TO service_role;

ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read prizes"
  ON public.prizes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_prizes_updated_at
  BEFORE UPDATE ON public.prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.prizes (id, name, short, image_url, is_win, probability, sort_order) VALUES
  ('cable',     'Data Cable',                 'Data Cable',     '/__l5e/assets-v1/d600b57a-cbe3-4f3f-baa0-2d57bba4a855/cable.png',     true,  25, 1),
  ('earphones', 'Strong Bass Earphones',      'Bass Earphones', '/__l5e/assets-v1/5e591fc7-8436-4bce-aff4-a0bfc0cabc70/earphones.png', true,  25, 2),
  ('ultima',    'Ultima Circle Smartwatch',   'Ultima Watch',   '/__l5e/assets-v1/9f8062fa-23a3-4e24-a577-87d21ac1432a/ultima.png',    true,  25, 3),
  ('kick',      'KICK AirBuds',               'Kick AirBuds',   '/__l5e/assets-v1/2a4ac7fd-f242-4031-bbe9-e2fa72fbd9a1/kick.png',      true,  0,  4),
  ('cash2000',  'Rs. 2000 Cash Back',         'Rs.2000 Cash',   '/__l5e/assets-v1/14c554cf-b4d0-402d-967a-3a9164457e44/cash2000.png',  true,  0,  5),
  ('cash1000',  'Rs. 1000 Cash Back',         'Rs.1000 Cash',   '/__l5e/assets-v1/9114e811-2639-4aa6-8bf5-27e6d00f9c8e/cash1000.png',  true,  0,  6),
  ('try-again', 'Try Again',                  'Try Again',      '/__l5e/assets-v1/db90f94f-04cb-4182-9b3b-763f9e2855f3/tryagain.png',  false, 25, 7),
  ('cash100',   'Rs. 100 Cash Back',          'Rs.100 Cash',    '/__l5e/assets-v1/27627ab9-769b-499a-a68d-09fd262c7bd0/cash100.png',   true,  25, 8);
