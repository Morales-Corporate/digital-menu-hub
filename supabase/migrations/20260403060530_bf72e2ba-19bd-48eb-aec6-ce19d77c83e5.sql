
-- Insert 'Ver Menú' and 'Modo Mesero' as modules
INSERT INTO public.modulos (clave, nombre, ruta, icono, grupo, orden, activo)
VALUES
  ('ver_menu', 'Ver Menú', '/', 'Eye', 'general', 15, true),
  ('modo_mesero', 'Modo Mesero', '/mesero', 'Users', 'general', 16, true);

-- Create default permissions for these new modules for all existing roles
INSERT INTO public.rol_permisos (rol_id, modulo_id, ver, crear, editar, eliminar, acciones_especiales)
SELECT rc.id, m.id, true, false, false, false, '[]'::jsonb
FROM public.roles_custom rc
CROSS JOIN public.modulos m
WHERE m.clave IN ('ver_menu', 'modo_mesero')
AND NOT EXISTS (
  SELECT 1 FROM public.rol_permisos rp WHERE rp.rol_id = rc.id AND rp.modulo_id = m.id
);
