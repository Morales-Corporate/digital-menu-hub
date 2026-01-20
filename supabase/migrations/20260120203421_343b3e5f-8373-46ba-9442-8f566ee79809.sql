-- Tabla principal de menús/combos
CREATE TABLE public.menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  imagen_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de opciones del menú (cada "slot" del combo: entrada, fondo, bebida, etc.)
CREATE TABLE public.menu_opciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, -- Ej: "Entrada", "Plato de fondo", "Bebida"
  orden INTEGER DEFAULT 0,
  cantidad INTEGER DEFAULT 1, -- Cuántos puede elegir de esta opción
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla que define qué productos/categorías están disponibles para cada opción
CREATE TABLE public.menu_opcion_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_opcion_id UUID NOT NULL REFERENCES public.menu_opciones(id) ON DELETE CASCADE,
  -- Puede ser una categoría completa O un producto específico
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE,
  -- Costo adicional (ej: gaseosa +2 soles)
  costo_adicional NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Debe tener al menos uno: categoria_id o producto_id
  CONSTRAINT menu_opcion_items_check CHECK (
    (categoria_id IS NOT NULL AND producto_id IS NULL) OR
    (categoria_id IS NULL AND producto_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_opcion_items ENABLE ROW LEVEL SECURITY;

-- Policies for menus
CREATE POLICY "Public read access for menus" ON public.menus FOR SELECT USING (true);
CREATE POLICY "Admins can manage menus" ON public.menus FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for menu_opciones
CREATE POLICY "Public read access for menu_opciones" ON public.menu_opciones FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu_opciones" ON public.menu_opciones FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for menu_opcion_items
CREATE POLICY "Public read access for menu_opcion_items" ON public.menu_opcion_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu_opcion_items" ON public.menu_opcion_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at en menus
CREATE TRIGGER update_menus_updated_at
BEFORE UPDATE ON public.menus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();