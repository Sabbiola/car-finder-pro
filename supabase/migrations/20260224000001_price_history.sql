-- Table to track price changes over time for each listing
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by listing
CREATE INDEX idx_price_history_listing_id ON public.price_history (listing_id, recorded_at DESC);

-- RLS: public read, service role write
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read price history"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage price history"
  ON public.price_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function: automatically insert into price_history when a listing price changes on upsert
CREATE OR REPLACE FUNCTION public.track_price_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- On insert or when price actually changed
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.price IS DISTINCT FROM NEW.price) THEN
    INSERT INTO public.price_history (listing_id, price, recorded_at)
    VALUES (NEW.id, NEW.price, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_price_change
  AFTER INSERT OR UPDATE ON public.car_listings
  FOR EACH ROW EXECUTE FUNCTION public.track_price_change();
