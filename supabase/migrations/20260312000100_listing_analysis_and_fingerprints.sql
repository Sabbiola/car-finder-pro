CREATE TABLE public.listing_image_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.car_listings(id) ON DELETE CASCADE,
  listing_hash TEXT NOT NULL,
  image_url TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_image_fingerprints_listing_hash
  ON public.listing_image_fingerprints (listing_hash);

CREATE INDEX idx_listing_image_fingerprints_fingerprint_hash
  ON public.listing_image_fingerprints (fingerprint_hash);

ALTER TABLE public.listing_image_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages listing image fingerprints"
  ON public.listing_image_fingerprints FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.seller_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.car_listings(id) ON DELETE CASCADE,
  seller_name TEXT,
  seller_external_id TEXT,
  seller_url TEXT,
  seller_phone_hash TEXT,
  seller_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seller_fingerprints_external_id
  ON public.seller_fingerprints (seller_external_id);

CREATE INDEX idx_seller_fingerprints_phone_hash
  ON public.seller_fingerprints (seller_phone_hash);

CREATE INDEX idx_seller_fingerprints_url
  ON public.seller_fingerprints (seller_url);

ALTER TABLE public.seller_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages seller fingerprints"
  ON public.seller_fingerprints FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.listing_analysis_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_key TEXT NOT NULL UNIQUE,
  listing_id UUID REFERENCES public.car_listings(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'fastapi',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_analysis_snapshots_listing_id
  ON public.listing_analysis_snapshots (listing_id);

CREATE INDEX idx_listing_analysis_snapshots_expires_at
  ON public.listing_analysis_snapshots (expires_at);

ALTER TABLE public.listing_analysis_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages analysis snapshots"
  ON public.listing_analysis_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
