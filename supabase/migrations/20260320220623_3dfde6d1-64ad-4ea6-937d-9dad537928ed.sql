CREATE POLICY "Cocina can read aperturas_caja"
ON public.aperturas_caja
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'cocina'::app_role));