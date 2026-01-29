-- Add is_combo_item flag to productos table
ALTER TABLE public.productos 
ADD COLUMN is_combo_item boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.productos.is_combo_item IS 'Products marked as combo items are only visible in the Menu/Combo tab during order creation';