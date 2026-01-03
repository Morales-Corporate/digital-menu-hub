-- Add new fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dni text,
ADD COLUMN IF NOT EXISTS direccion text,
ADD COLUMN IF NOT EXISTS referencia_direccion text,
ADD COLUMN IF NOT EXISTS latitud double precision,
ADD COLUMN IF NOT EXISTS longitud double precision,
ADD COLUMN IF NOT EXISTS tipo_comprobante text DEFAULT 'boleta';

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes-pago', 'comprobantes-pago', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for comprobantes-pago bucket
CREATE POLICY "Users can upload their own payment receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprobantes-pago' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own payment receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes-pago' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all payment receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes-pago' 
  AND has_role(auth.uid(), 'admin'::app_role)
);