
-- 1. Enum tipo_producto
DO $$ BEGIN
  CREATE TYPE public.tipo_producto AS ENUM ('elaborado', 'reventa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columna en productos
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS tipo_producto public.tipo_producto NOT NULL DEFAULT 'elaborado';

-- 3. Reescribir función de descuento para diferenciar elaborados vs reventa
CREATE OR REPLACE FUNCTION public.descontar_insumos_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  prod RECORD;
  insumo_rec RECORD;
  config RECORD;
BEGIN
  IF NEW.estado = 'confirmado' AND (OLD.estado IS NULL OR OLD.estado != 'confirmado') THEN
    FOR item IN
      SELECT oi.producto_id, oi.cantidad
      FROM orden_items oi
      WHERE oi.orden_id = NEW.id
    LOOP
      SELECT id, tipo_producto, stock INTO prod
      FROM productos WHERE id = item.producto_id;

      IF prod.tipo_producto = 'reventa' THEN
        -- Descuento directo de stock del producto (si está controlado)
        IF prod.stock IS NOT NULL THEN
          UPDATE productos
          SET stock = GREATEST(0, stock - item.cantidad),
              updated_at = now()
          WHERE id = item.producto_id;
        END IF;
      ELSE
        -- Elaborado: descontar insumos por receta
        UPDATE insumos i
        SET stock_actual = GREATEST(0, i.stock_actual - (pi.cantidad * item.cantidad)),
            updated_at = now()
        FROM producto_insumos pi
        WHERE pi.producto_id = item.producto_id
          AND pi.insumo_id = i.id;
      END IF;
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
$function$;
