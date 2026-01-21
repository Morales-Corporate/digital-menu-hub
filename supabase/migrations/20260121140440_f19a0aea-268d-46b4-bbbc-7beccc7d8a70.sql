-- Agregar columna categoria_id a menu_opciones para vincular directamente a categorías
ALTER TABLE public.menu_opciones 
ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL;

-- Comentario: Ahora cada opción del menú se vincula directamente a una categoría,
-- y todos los productos de esa categoría estarán disponibles automáticamente