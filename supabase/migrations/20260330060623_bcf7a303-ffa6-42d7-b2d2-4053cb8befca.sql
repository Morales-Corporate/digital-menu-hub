
-- Table for operational/fixed costs (luz, agua, personal, etc.)
CREATE TABLE public.costos_operativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'otros',
  monto numeric NOT NULL DEFAULT 0,
  periodo text NOT NULL DEFAULT 'mensual',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.costos_operativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage costos_operativos"
  ON public.costos_operativos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_costos_operativos_updated_at
  BEFORE UPDATE ON public.costos_operativos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
