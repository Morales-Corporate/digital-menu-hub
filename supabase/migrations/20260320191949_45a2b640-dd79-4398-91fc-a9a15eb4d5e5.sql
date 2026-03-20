
CREATE TABLE public.aperturas_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_apertura timestamptz NOT NULL DEFAULT now(),
  fecha_cierre timestamptz,
  monto_inicial numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  tipo_apertura text NOT NULL DEFAULT 'normal',
  tipo_cierre text,
  observacion text,
  total_ventas numeric NOT NULL DEFAULT 0,
  total_efectivo numeric NOT NULL DEFAULT 0,
  total_yape_plin numeric NOT NULL DEFAULT 0,
  total_tarjeta numeric NOT NULL DEFAULT 0,
  total_retiros numeric NOT NULL DEFAULT 0,
  ordenes_entregadas integer NOT NULL DEFAULT 0,
  ordenes_canceladas integer NOT NULL DEFAULT 0,
  efectivo_esperado numeric NOT NULL DEFAULT 0,
  efectivo_real numeric,
  diferencia numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aperturas_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage aperturas_caja"
  ON public.aperturas_caja
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
