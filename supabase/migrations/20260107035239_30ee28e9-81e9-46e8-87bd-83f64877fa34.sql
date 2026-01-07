-- Tabla para configurar los niveles de recompensa (admin)
CREATE TABLE public.recompensas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  puntos_requeridos integer NOT NULL,
  porcentaje_descuento integer NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabla para descuentos activos del usuario
CREATE TABLE public.descuentos_activos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recompensa_id uuid NOT NULL REFERENCES public.recompensas(id) ON DELETE CASCADE,
  puntos_usados integer NOT NULL,
  usado boolean DEFAULT false,
  orden_id uuid REFERENCES public.ordenes(id),
  created_at timestamp with time zone DEFAULT now(),
  usado_at timestamp with time zone
);

-- Habilitar RLS
ALTER TABLE public.recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descuentos_activos ENABLE ROW LEVEL SECURITY;

-- Políticas para recompensas (todos pueden ver, solo admin modifica)
CREATE POLICY "Public read access for recompensas"
ON public.recompensas FOR SELECT
USING (true);

CREATE POLICY "Admins can manage recompensas"
ON public.recompensas FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para descuentos_activos
CREATE POLICY "Users can view own discounts"
ON public.descuentos_activos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discounts"
ON public.descuentos_activos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discounts"
ON public.descuentos_activos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all discounts"
ON public.descuentos_activos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at en recompensas
CREATE TRIGGER update_recompensas_updated_at
BEFORE UPDATE ON public.recompensas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar recompensas por defecto
INSERT INTO public.recompensas (nombre, puntos_requeridos, porcentaje_descuento) VALUES
('Descuento Bronce', 100, 15),
('Descuento Plata', 200, 25);