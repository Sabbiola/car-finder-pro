-- Rate limiting table for edge functions (prevents scraping abuse)
CREATE TABLE public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_key TEXT NOT NULL,       -- IP hash or anon key hash
  action TEXT NOT NULL,           -- e.g. 'scrape-listings'
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_request TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limits_client_action
  ON public.api_rate_limits (client_key, action);

CREATE INDEX idx_rate_limits_window
  ON public.api_rate_limits (window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits table
CREATE POLICY "Service role manages rate limits"
  ON public.api_rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-cleanup old windows (run periodically or via pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;
