-- Add user_id column to meseros for auto-detection of logged-in waiter
ALTER TABLE public.meseros ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create unique index so one auth user maps to one mesero
CREATE UNIQUE INDEX IF NOT EXISTS meseros_user_id_unique ON public.meseros(user_id) WHERE user_id IS NOT NULL;

-- Allow mesero role to read necessary tables
CREATE POLICY "Meseros can read aperturas_caja" ON public.aperturas_caja FOR SELECT TO authenticated USING (has_role(auth.uid(), 'mesero'::app_role));

CREATE POLICY "Meseros can manage ordenes" ON public.ordenes FOR ALL TO authenticated USING (has_role(auth.uid(), 'mesero'::app_role)) WITH CHECK (has_role(auth.uid(), 'mesero'::app_role));

CREATE POLICY "Meseros can manage orden_items" ON public.orden_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'mesero'::app_role)) WITH CHECK (has_role(auth.uid(), 'mesero'::app_role));

CREATE POLICY "Meseros can read meseros" ON public.meseros FOR SELECT TO authenticated USING (has_role(auth.uid(), 'mesero'::app_role));