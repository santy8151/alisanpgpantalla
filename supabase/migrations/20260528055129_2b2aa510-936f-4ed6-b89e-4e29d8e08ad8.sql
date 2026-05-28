
CREATE TABLE public.face_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  descriptor double precision[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_enrollments TO anon, authenticated;
GRANT ALL ON public.face_enrollments TO service_role;

ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage face enrollments"
ON public.face_enrollments
FOR ALL
TO public
USING (true)
WITH CHECK (true);
