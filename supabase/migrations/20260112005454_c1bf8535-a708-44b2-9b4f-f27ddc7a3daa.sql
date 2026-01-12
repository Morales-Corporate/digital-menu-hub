-- Add ingredients and allergens columns to productos table
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS ingredientes TEXT,
ADD COLUMN IF NOT EXISTS alergenos TEXT[];