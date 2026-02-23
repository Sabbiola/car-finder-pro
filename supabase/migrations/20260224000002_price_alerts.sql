-- Price alerts: users get notified when a listing drops below their target price
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- For anonymous users we store a client fingerprint (localStorage key)
  client_id TEXT,
  listing_id UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  target_price INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT price_alerts_user_check CHECK (user_id IS NOT NULL OR client_id IS NOT NULL)
);

CREATE INDEX idx_price_alerts_listing ON public.price_alerts (listing_id) WHERE is_active = true;
CREATE INDEX idx_price_alerts_user ON public.price_alerts (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Authenticated users manage their own alerts
CREATE POLICY "Users manage own alerts"
  ON public.price_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all alerts (for notification job)
CREATE POLICY "Service role manages all alerts"
  ON public.price_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anonymous/client-side read by client_id
CREATE POLICY "Client reads own alerts"
  ON public.price_alerts FOR SELECT
  USING (client_id IS NOT NULL);
