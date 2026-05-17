
-- Add product image url to service catalog
ALTER TABLE public.service_prices ADD COLUMN IF NOT EXISTS image_url text;

-- Active jobs board: placas en proceso visibles al cliente
CREATE TABLE IF NOT EXISTS public.active_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  customer text,
  service_type text NOT NULL DEFAULT 'revision', -- revision | instalacion
  service_name text,
  status text NOT NULL DEFAULT 'en_proceso',     -- en_proceso | llamado | finalizado
  estimated_minutes integer NOT NULL DEFAULT 30,
  progress integer NOT NULL DEFAULT 10,
  delay_message text,
  bay text,                                       -- p.ej. "Bahía 3"
  called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active_jobs"
  ON public.active_jobs FOR SELECT USING (true);

CREATE POLICY "Anyone can manage active_jobs"
  ON public.active_jobs FOR ALL USING (true) WITH CHECK (true);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS active_jobs_touch ON public.active_jobs;
CREATE TRIGGER active_jobs_touch BEFORE UPDATE ON public.active_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_jobs;
ALTER TABLE public.active_jobs REPLICA IDENTITY FULL;
