
CREATE TABLE public.service_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service prices"
  ON public.service_prices FOR SELECT
  USING (true);

INSERT INTO public.service_prices (category, name, price) VALUES
  ('compresor', 'Compresor Copeland 1HP', 850000),
  ('compresor', 'Compresor Copeland 2HP', 1250000),
  ('compresor', 'Compresor Bristol 1.5HP', 980000),
  ('compresor', 'Compresor Tecumseh 3HP', 1650000),
  ('compresor', 'Compresor Embraco 1HP', 720000),
  ('evaporador', 'Evaporador 12000 BTU', 380000),
  ('evaporador', 'Evaporador 18000 BTU', 520000),
  ('evaporador', 'Evaporador 24000 BTU', 680000),
  ('evaporador', 'Evaporador 36000 BTU', 920000),
  ('condensador', 'Condensador 12000 BTU', 420000),
  ('condensador', 'Condensador 18000 BTU', 580000),
  ('condensador', 'Condensador 24000 BTU', 750000),
  ('condensador', 'Condensador 36000 BTU', 1020000),
  ('ventilador', 'Ventilador eléctrico axial 10"', 145000),
  ('ventilador', 'Ventilador eléctrico axial 12"', 175000),
  ('ventilador', 'Ventilador eléctrico centrífugo', 235000),
  ('trompo', 'Trompo presostático baja presión', 95000),
  ('trompo', 'Trompo presostático alta presión', 125000),
  ('trompo', 'Trompo presostático dual', 185000),
  ('instalacion', 'Instalación eléctrica con switche sencillo', 220000),
  ('instalacion', 'Instalación eléctrica con switche doble', 320000),
  ('instalacion', 'Instalación eléctrica con switche industrial', 480000),
  ('mano_obra', 'Mano de obra instalación completa', 350000);
