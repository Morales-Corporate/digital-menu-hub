-- Update products in "Menu - *" categories to be marked as combo items
UPDATE public.productos 
SET is_combo_item = true 
WHERE categoria_id IN (
  SELECT id FROM public.categorias 
  WHERE nombre ILIKE 'Menu%' OR nombre ILIKE 'Menu -%'
) AND is_combo_item = false;