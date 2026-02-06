-- Create table for business configuration
CREATE TABLE public.configuracion_empresa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_comercial text NOT NULL,
  razon_social text,
  ruc text,
  direccion text,
  telefono text,
  email text,
  logo_url text,
  -- Numbering configuration
  serie_boleta text DEFAULT 'B001',
  numero_boleta integer DEFAULT 1,
  serie_factura text DEFAULT 'F001',
  numero_factura integer DEFAULT 1,
  -- Additional info
  mensaje_pie text DEFAULT 'Gracias por su preferencia',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracion_empresa ENABLE ROW LEVEL SECURITY;

-- Only admins can manage configuration
CREATE POLICY "Admins can manage configuracion_empresa"
  ON public.configuracion_empresa FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read for generating receipts (needed for printing)
CREATE POLICY "Public read for configuracion_empresa"
  ON public.configuracion_empresa FOR SELECT
  USING (true);

-- Create table for issued receipts/invoices
CREATE TABLE public.comprobantes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id uuid REFERENCES public.ordenes(id),
  tipo text NOT NULL CHECK (tipo IN ('boleta', 'factura')),
  serie text NOT NULL,
  numero integer NOT NULL,
  -- Customer data
  cliente_nombre text,
  cliente_documento text,
  cliente_direccion text,
  cliente_ruc text,
  cliente_razon_social text,
  -- Totals
  subtotal numeric NOT NULL DEFAULT 0,
  igv numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  -- Status
  anulado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.comprobantes ENABLE ROW LEVEL SECURITY;

-- Admins can manage comprobantes
CREATE POLICY "Admins can manage comprobantes"
  ON public.comprobantes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger to update updated_at
CREATE TRIGGER update_configuracion_empresa_updated_at
  BEFORE UPDATE ON public.configuracion_empresa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create unique constraint for comprobante numbering
CREATE UNIQUE INDEX comprobantes_serie_numero_tipo_idx 
  ON public.comprobantes(tipo, serie, numero) 
  WHERE anulado = false;