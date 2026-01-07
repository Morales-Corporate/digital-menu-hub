-- Tabla para registrar los cierres de caja diarios
CREATE TABLE public.cierres_caja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  total_ventas NUMERIC NOT NULL DEFAULT 0,
  total_efectivo NUMERIC NOT NULL DEFAULT 0,
  total_yape_plin NUMERIC NOT NULL DEFAULT 0,
  total_tarjeta NUMERIC NOT NULL DEFAULT 0,
  ordenes_entregadas INTEGER NOT NULL DEFAULT 0,
  ordenes_canceladas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabla para registrar movimientos de caja (retiros, egresos)
CREATE TABLE public.movimientos_caja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('retiro', 'ingreso')),
  monto NUMERIC NOT NULL,
  motivo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;

-- Policies para cierres_caja (solo admins)
CREATE POLICY "Admins can manage cierres_caja"
ON public.cierres_caja
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para movimientos_caja (solo admins)
CREATE POLICY "Admins can manage movimientos_caja"
ON public.movimientos_caja
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indices para mejor rendimiento
CREATE INDEX idx_cierres_caja_fecha ON public.cierres_caja(fecha);
CREATE INDEX idx_movimientos_caja_fecha ON public.movimientos_caja(fecha);