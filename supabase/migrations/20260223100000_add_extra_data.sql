ALTER TABLE public.car_listings ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}';
