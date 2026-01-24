-- Add parent_id to categorias for hierarchical structure (classification -> subclassification)
ALTER TABLE public.categorias
ADD COLUMN parent_id uuid REFERENCES public.categorias(id) ON DELETE CASCADE;

-- Add index for faster queries
CREATE INDEX idx_categorias_parent_id ON public.categorias(parent_id);

-- Add comment to explain the structure
COMMENT ON COLUMN public.categorias.parent_id IS 'Parent category ID. NULL means it is a root category (classification), otherwise it is a subcategory';