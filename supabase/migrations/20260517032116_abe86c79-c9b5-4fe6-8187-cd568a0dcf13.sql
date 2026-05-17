
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL,
  customer text,
  legal_name text,
  doc_id text,
  person_type text,
  invoice_mode text,
  email text,
  plate text,
  proceso text,
  proceso_valor numeric DEFAULT 0,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric DEFAULT 0,
  iva numeric DEFAULT 0,
  total numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Anyone can manage invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read service-images" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');
CREATE POLICY "Public upload service-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'service-images');
CREATE POLICY "Public update service-images" ON storage.objects FOR UPDATE USING (bucket_id = 'service-images');
CREATE POLICY "Public delete service-images" ON storage.objects FOR DELETE USING (bucket_id = 'service-images');
