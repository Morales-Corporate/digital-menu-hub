-- Add columns to ordenes table for guest orders
ALTER TABLE public.ordenes 
ADD COLUMN IF NOT EXISTS es_invitado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nombre_invitado TEXT,
ADD COLUMN IF NOT EXISTS telefono_invitado TEXT,
ADD COLUMN IF NOT EXISTS numero_mesa INTEGER;

-- Make user_id nullable for guest orders
ALTER TABLE public.ordenes 
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow guest orders (anonymous inserts)
CREATE POLICY "Anonymous users can insert guest orders" 
ON public.ordenes 
FOR INSERT 
WITH CHECK (es_invitado = true AND user_id IS NULL);

CREATE POLICY "Anonymous users can view guest orders by id" 
ON public.ordenes 
FOR SELECT 
USING (es_invitado = true AND user_id IS NULL);

-- Allow anonymous inserts on orden_items for guest orders
CREATE POLICY "Anonymous users can insert order items for guest orders" 
ON public.orden_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM ordenes 
  WHERE ordenes.id = orden_items.orden_id 
  AND ordenes.es_invitado = true 
  AND ordenes.user_id IS NULL
));

CREATE POLICY "Anonymous users can view order items for guest orders" 
ON public.orden_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM ordenes 
  WHERE ordenes.id = orden_items.orden_id 
  AND ordenes.es_invitado = true 
  AND ordenes.user_id IS NULL
));