-- Add notas field to ordenes for order-level notes
ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS notas text;

-- Add nota field to orden_items for per-item notes (e.g. "sin crema")
ALTER TABLE public.orden_items ADD COLUMN IF NOT EXISTS nota text;