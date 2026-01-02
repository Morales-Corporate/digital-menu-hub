-- Add estado column to ordenes table
ALTER TABLE public.ordenes 
ADD COLUMN estado text NOT NULL DEFAULT 'pendiente';

-- Add payment info columns
ALTER TABLE public.ordenes 
ADD COLUMN metodo_pago text DEFAULT 'yape_plin',
ADD COLUMN comprobante_pago text;

-- Create index for faster queries by status
CREATE INDEX idx_ordenes_estado ON public.ordenes(estado);

-- Add policy for users to insert their own orders
CREATE POLICY "Users can insert own orders"
ON public.ordenes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add policy for users to insert their own order items
CREATE POLICY "Users can insert own order items"
ON public.orden_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ordenes 
    WHERE ordenes.id = orden_items.orden_id 
    AND ordenes.user_id = auth.uid()
  )
);

-- Enable realtime for ordenes table
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;