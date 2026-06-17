REVOKE ALL ON public.access_codes FROM anon, authenticated;
GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No client access to access_codes" ON public.access_codes;
CREATE POLICY "No client access to access_codes"
  ON public.access_codes
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);