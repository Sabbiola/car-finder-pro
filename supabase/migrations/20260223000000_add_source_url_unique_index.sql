-- Add UNIQUE constraint on source_url to enable UPSERT deduplication
-- PostgreSQL allows multiple NULLs in a UNIQUE constraint (NULLs are distinct)
-- so listings without source_url can coexist without conflicts

ALTER TABLE public.car_listings
  ADD CONSTRAINT car_listings_source_url_unique UNIQUE (source_url);

-- Add composite index on brand, model, scraped_at for efficient cache TTL queries
CREATE INDEX IF NOT EXISTS idx_listings_scraped_at
  ON public.car_listings (brand, model, scraped_at DESC);
