CREATE TABLE public.alert_delivery_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.price_alerts(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  status TEXT NOT NULL CHECK (status IN ('success', 'retrying', 'failed', 'skipped', 'triggered_dry_run')),
  channel TEXT,
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  idempotency_key TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alert_id, attempt_number)
);

CREATE INDEX idx_alert_delivery_attempts_alert_created
  ON public.alert_delivery_attempts (alert_id, created_at DESC);

CREATE INDEX idx_alert_delivery_attempts_retry
  ON public.alert_delivery_attempts (status, next_retry_at);

CREATE INDEX idx_alert_delivery_attempts_run
  ON public.alert_delivery_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.alert_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages alert delivery attempts"
  ON public.alert_delivery_attempts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
