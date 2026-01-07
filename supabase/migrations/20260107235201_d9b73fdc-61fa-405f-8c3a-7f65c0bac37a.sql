-- Tabla de meseros
CREATE TABLE public.meseros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de asignación de mesas a meseros por turno
CREATE TABLE public.asignacion_mesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mesero_id UUID NOT NULL REFERENCES public.meseros(id) ON DELETE CASCADE,
  mesa_inicio INTEGER NOT NULL,
  mesa_fin INTEGER NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  turno TEXT NOT NULL DEFAULT 'dia', -- 'dia' o 'noche'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(fecha, turno, mesero_id)
);

-- Agregar columna mesero_id a órdenes para registro real
ALTER TABLE public.ordenes 
ADD COLUMN mesero_id UUID REFERENCES public.meseros(id) ON DELETE SET NULL;

-- Agregar timestamp para calcular tiempo de atención
ALTER TABLE public.ordenes 
ADD COLUMN entregado_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.meseros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignacion_mesas ENABLE ROW LEVEL SECURITY;

-- Policies para meseros
CREATE POLICY "Admins can manage meseros" 
ON public.meseros 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read access for meseros" 
ON public.meseros 
FOR SELECT 
USING (true);

-- Policies para asignacion_mesas
CREATE POLICY "Admins can manage asignacion_mesas" 
ON public.asignacion_mesas 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read access for asignacion_mesas" 
ON public.asignacion_mesas 
FOR SELECT 
USING (true);

-- Trigger para updated_at en meseros
CREATE TRIGGER update_meseros_updated_at
BEFORE UPDATE ON public.meseros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();