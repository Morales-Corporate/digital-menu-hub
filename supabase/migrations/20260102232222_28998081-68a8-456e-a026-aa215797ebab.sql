-- Fix: Update admin@gmail.com to have admin role
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '0e8828e3-89db-490b-b7b4-113bc8b70213';

-- Add birthday and phone to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
ADD COLUMN IF NOT EXISTS telefono text;

-- Create points system table
CREATE TABLE public.puntos_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  puntos_totales integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.puntos_usuario ENABLE ROW LEVEL SECURITY;

-- Users can view their own points
CREATE POLICY "Users can view own points"
ON public.puntos_usuario FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all points
CREATE POLICY "Admins can manage all points"
ON public.puntos_usuario FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create orders table for tracking last order
CREATE TABLE public.ordenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  puntos_ganados integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
ON public.ordenes FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all orders
CREATE POLICY "Admins can manage all orders"
ON public.ordenes FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Order items table
CREATE TABLE public.orden_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid REFERENCES public.ordenes(id) ON DELETE CASCADE NOT NULL,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orden_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own order items
CREATE POLICY "Users can view own order items"
ON public.orden_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ordenes 
    WHERE ordenes.id = orden_items.orden_id 
    AND ordenes.user_id = auth.uid()
  )
);

-- Admins can manage all order items
CREATE POLICY "Admins can manage all order items"
ON public.orden_items FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Initialize points for existing users
INSERT INTO public.puntos_usuario (user_id, puntos_totales)
SELECT id, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;