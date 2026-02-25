-- Index to speed up DELETE queries during scraping (Automobile.it / BrumBrum without source_url)
-- Without this, scrape-listings DELETE scans the entire table on every run

CREATE INDEX IF NOT EXISTS idx_listings_brand_model_source
  ON public.car_listings (brand, model, source);
