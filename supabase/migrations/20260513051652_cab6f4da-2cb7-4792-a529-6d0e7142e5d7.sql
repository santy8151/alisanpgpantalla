ALTER TABLE public.service_prices ADD COLUMN IF NOT EXISTS delivery_minutes INTEGER NOT NULL DEFAULT 30;

DROP POLICY IF EXISTS "Allow public manage service_prices" ON public.service_prices;
CREATE POLICY "Allow public manage service_prices" ON public.service_prices FOR ALL USING (true) WITH CHECK (true);