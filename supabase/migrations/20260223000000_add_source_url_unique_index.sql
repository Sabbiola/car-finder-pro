-- Add unique partial index on source_url to enable UPSERT deduplication
-- Partial index (WHERE source_url IS NOT NULL) avoids conflicts on null values
-- since multiple listings without a source_url can legitimately coexist

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_source_url
  ON public.car_listings (source_url)
  WHERE source_url IS NOT NULL;

-- Add composite index on brand, model, scraped_at for efficient cache TTL queries
CREATE INDEX IF NOT EXISTS idx_listings_scraped_at
  ON public.car_listings (brand, model, scraped_at DESC);
