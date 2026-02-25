-- Prevent duplicate price alerts for the same listing/client/target
-- Without this, double-clicking "Crea alert" creates multiple identical notifications

ALTER TABLE public.price_alerts
  ADD CONSTRAINT price_alerts_unique_per_client
  UNIQUE (listing_id, client_id, target_price);
