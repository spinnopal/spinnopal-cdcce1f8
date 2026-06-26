-- Authenticated users (owners / super admins) need all columns; their RLS policies
-- already restrict which rows they can see.
GRANT SELECT ON public.shops TO authenticated;