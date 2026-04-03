
-- Add business type and visible order statuses to configuracion_empresa
ALTER TABLE public.configuracion_empresa
ADD COLUMN IF NOT EXISTS tipo_negocio text NOT NULL DEFAULT 'restaurante',
ADD COLUMN IF NOT EXISTS estados_pedido_visibles text[] NOT NULL DEFAULT ARRAY['pendiente','en_preparacion','listo','entregado','pagado'];
