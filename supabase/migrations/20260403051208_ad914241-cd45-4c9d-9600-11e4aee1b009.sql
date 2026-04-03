
-- Tabla de roles personalizados
CREATE TABLE public.roles_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.roles_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage roles_custom" ON public.roles_custom
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read roles_custom" ON public.roles_custom
  FOR SELECT TO authenticated USING (true);

-- Tabla de módulos del sistema
CREATE TABLE public.modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  nombre text NOT NULL,
  grupo text DEFAULT 'general',
  icono text,
  ruta text,
  orden integer DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage modulos" ON public.modulos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read modulos" ON public.modulos
  FOR SELECT TO authenticated USING (true);

-- Tabla de permisos por rol
CREATE TABLE public.rol_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id uuid NOT NULL REFERENCES public.roles_custom(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  ver boolean NOT NULL DEFAULT false,
  crear boolean NOT NULL DEFAULT false,
  editar boolean NOT NULL DEFAULT false,
  eliminar boolean NOT NULL DEFAULT false,
  acciones_especiales jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rol_id, modulo_id)
);

ALTER TABLE public.rol_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rol_permisos" ON public.rol_permisos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read rol_permisos" ON public.rol_permisos
  FOR SELECT TO authenticated USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_roles_custom_updated_at
  BEFORE UPDATE ON public.roles_custom
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rol_permisos_updated_at
  BEFORE UPDATE ON public.rol_permisos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Módulos del sistema
INSERT INTO public.modulos (clave, nombre, grupo, ruta, orden) VALUES
  ('dashboard', 'Dashboard', 'principal', '/admin', 1),
  ('pedidos', 'Pedidos', 'operaciones', '/admin/ordenes', 2),
  ('estadisticas', 'Estadísticas', 'reportes', '/admin/estadisticas', 3),
  ('caja', 'Caja', 'operaciones', '/admin/caja', 4),
  ('meseros', 'Meseros', 'personal', '/admin/meseros', 5),
  ('mesas_qr', 'Mesas QR', 'operaciones', '/admin/mesas', 6),
  ('categorias', 'Categorías', 'catalogo', '/admin/categorias', 7),
  ('menus_combos', 'Menús/Combos', 'catalogo', '/admin/menus', 8),
  ('productos', 'Productos', 'catalogo', '/admin/productos', 9),
  ('insumos', 'Insumos', 'inventario', '/admin/insumos', 10),
  ('reportes', 'Reportes', 'reportes', '/admin/reportes', 11),
  ('recompensas', 'Recompensas', 'catalogo', '/admin/recompensas', 12),
  ('usuarios_roles', 'Usuarios / Roles', 'sistema', '/admin/roles', 13),
  ('configuracion', 'Configuración', 'sistema', '/admin/configuracion', 14);

-- Seed: Roles base
INSERT INTO public.roles_custom (nombre, descripcion, es_sistema) VALUES
  ('Administrador', 'Acceso completo a todos los módulos del sistema', true),
  ('Mesero', 'Acceso a pedidos, mesas y funciones de servicio', true),
  ('Cocina', 'Acceso solo a la vista de cocina y pedidos', true),
  ('Usuario básico', 'Acceso limitado al sistema', true);

-- Seed: Permisos del Administrador (acceso total)
INSERT INTO public.rol_permisos (rol_id, modulo_id, ver, crear, editar, eliminar, acciones_especiales)
SELECT r.id, m.id, true, true, true, true, 
  CASE 
    WHEN m.clave = 'caja' THEN '["cerrar_caja","registrar_pago","retiro_efectivo"]'::jsonb
    WHEN m.clave = 'pedidos' THEN '["confirmar_pago","cancelar_orden"]'::jsonb
    ELSE '[]'::jsonb
  END
FROM public.roles_custom r, public.modulos m
WHERE r.nombre = 'Administrador';

-- Seed: Permisos del Mesero
INSERT INTO public.rol_permisos (rol_id, modulo_id, ver, crear, editar, eliminar, acciones_especiales)
SELECT r.id, m.id,
  m.clave IN ('dashboard','pedidos','mesas_qr','productos','menus_combos','categorias'),
  m.clave IN ('pedidos'),
  m.clave IN ('pedidos'),
  false,
  CASE WHEN m.clave = 'pedidos' THEN '["confirmar_pago"]'::jsonb ELSE '[]'::jsonb END
FROM public.roles_custom r, public.modulos m
WHERE r.nombre = 'Mesero';

-- Seed: Permisos de Cocina
INSERT INTO public.rol_permisos (rol_id, modulo_id, ver, crear, editar, eliminar, acciones_especiales)
SELECT r.id, m.id,
  m.clave IN ('pedidos'),
  false, false, false, '[]'::jsonb
FROM public.roles_custom r, public.modulos m
WHERE r.nombre = 'Cocina';

-- Seed: Permisos de Usuario básico
INSERT INTO public.rol_permisos (rol_id, modulo_id, ver, crear, editar, eliminar, acciones_especiales)
SELECT r.id, m.id,
  m.clave IN ('dashboard'),
  false, false, false, '[]'::jsonb
FROM public.roles_custom r, public.modulos m
WHERE r.nombre = 'Usuario básico';
