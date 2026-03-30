-- Tabla de insumos (materias primas)
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad_medida text NOT NULL DEFAULT 'unidad',
  costo_por_unidad numeric NOT NULL DEFAULT 0,
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage insumos" ON public.insumos FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Cocina can read insumos" ON public.insumos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cocina'));

-- Relación producto-insumos (receta)
CREATE TABLE public.producto_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(producto_id, insumo_id)
);

ALTER TABLE public.producto_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage producto_insumos" ON public.producto_insumos FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read producto_insumos" ON public.producto_insumos FOR SELECT TO public
  USING (true);

-- Registro de compras/reabastecimiento
CREATE TABLE public.compras_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL,
  costo_unitario numeric NOT NULL DEFAULT 0,
  costo_total numeric NOT NULL DEFAULT 0,
  proveedor text,
  nota text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.compras_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage compras_insumos" ON public.compras_insumos FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'));

-- Configuración de alertas de stock
CREATE TABLE public.alertas_stock_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  umbral_porcentaje integer NOT NULL DEFAULT 15,
  notificar_sistema boolean NOT NULL DEFAULT true,
  notificar_email boolean NOT NULL DEFAULT false,
  email_destino text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.alertas_stock_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alertas_config" ON public.alertas_stock_config FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'));

-- Insertar config por defecto
INSERT INTO public.alertas_stock_config (umbral_porcentaje, notificar_sistema, notificar_email)
VALUES (15, true, false);

-- Tabla de notificaciones de stock bajo
CREATE TABLE public.alertas_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  mensaje text NOT NULL,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.alertas_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alertas_stock" ON public.alertas_stock FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'));

-- Función para descontar insumos cuando un pedido es confirmado
CREATE OR REPLACE FUNCTION public.descontar_insumos_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
  insumo_rec RECORD;
  config RECORD;
BEGIN
  IF NEW.estado = 'confirmado' AND (OLD.estado IS NULL OR OLD.estado != 'confirmado') THEN
    FOR item IN 
      SELECT oi.producto_id, oi.cantidad 
      FROM orden_items oi 
      WHERE oi.orden_id = NEW.id
    LOOP
      UPDATE insumos i
      SET stock_actual = GREATEST(0, i.stock_actual - (pi.cantidad * item.cantidad)),
          updated_at = now()
      FROM producto_insumos pi
      WHERE pi.producto_id = item.producto_id
        AND pi.insumo_id = i.id;
    END LOOP;

    SELECT * INTO config FROM alertas_stock_config LIMIT 1;
    
    IF config IS NOT NULL AND config.notificar_sistema THEN
      FOR insumo_rec IN
        SELECT i.id, i.nombre, i.stock_actual, i.stock_minimo
        FROM insumos i
        WHERE i.stock_minimo > 0 
          AND i.stock_actual <= i.stock_minimo
          AND NOT EXISTS (
            SELECT 1 FROM alertas_stock a 
            WHERE a.insumo_id = i.id AND a.leida = false
          )
      LOOP
        INSERT INTO alertas_stock (insumo_id, mensaje)
        VALUES (insumo_rec.id, 
          'Stock bajo de ' || insumo_rec.nombre || ': quedan ' || insumo_rec.stock_actual || ' unidades (mínimo: ' || insumo_rec.stock_minimo || ')');
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_descontar_insumos
  AFTER UPDATE ON public.ordenes
  FOR EACH ROW
  EXECUTE FUNCTION public.descontar_insumos_orden();

CREATE TRIGGER set_updated_at_insumos
  BEFORE UPDATE ON public.insumos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();