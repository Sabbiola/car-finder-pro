-- Harden price_alerts: anonymous reads were previously too broad.
-- Anonymous users store alerts locally, so DB rows should stay private to owner/service role.
DROP POLICY IF EXISTS "Client reads own alerts" ON public.price_alerts;
