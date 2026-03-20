-- Allow cocina role to read orders and order items
CREATE POLICY "Cocina can read ordenes"
ON public.ordenes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'cocina'::app_role));

CREATE POLICY "Cocina can update ordenes estado"
ON public.ordenes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cocina'::app_role))
WITH CHECK (has_role(auth.uid(), 'cocina'::app_role));

CREATE POLICY "Cocina can read orden_items"
ON public.orden_items
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'cocina'::app_role));

CREATE POLICY "Cocina can read productos"
ON public.productos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'cocina'::app_role));