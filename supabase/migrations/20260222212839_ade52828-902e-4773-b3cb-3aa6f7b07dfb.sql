
-- Table for storing scraped car listings
CREATE TABLE public.car_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  year INTEGER NOT NULL,
  price INTEGER NOT NULL,
  km INTEGER NOT NULL,
  fuel TEXT,
  transmission TEXT,
  power TEXT,
  color TEXT,
  doors INTEGER,
  body_type TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  image_url TEXT,
  location TEXT,
  is_new BOOLEAN DEFAULT false,
  is_best_deal BOOLEAN DEFAULT false,
  price_rating TEXT CHECK (price_rating IN ('best', 'good', 'normal')),
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Public read access (no auth needed for browsing)
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read listings"
  ON public.car_listings FOR SELECT
  USING (true);

-- Only service role can insert/update (from edge functions)
CREATE POLICY "Service role can manage listings"
  ON public.car_listings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes for common search patterns
CREATE INDEX idx_listings_brand ON public.car_listings (brand);
CREATE INDEX idx_listings_brand_model ON public.car_listings (brand, model);
CREATE INDEX idx_listings_price ON public.car_listings (price);
CREATE INDEX idx_listings_year ON public.car_listings (year);
CREATE INDEX idx_listings_source ON public.car_listings (source);
