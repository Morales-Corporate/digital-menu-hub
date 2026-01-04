-- Add stock column to productos table
ALTER TABLE public.productos 
ADD COLUMN stock integer DEFAULT NULL;

-- NULL = stock ilimitado, 0 = agotado, >0 = cantidad disponible