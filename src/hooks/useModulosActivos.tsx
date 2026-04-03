import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ModuloRow {
  id: string;
  clave: string;
  ruta: string | null;
  activo: boolean;
  canView?: boolean;
}

interface PermisoRow {
  modulo_id: string;
  ver: boolean;
}

const ROLE_NAME_MAP: Record<string, string> = {
  admin: 'Administrador',
  mesero: 'Mesero',
  cocina: 'Cocina',
  user: 'Usuario básico',
};

export function useModulosActivos() {
  const { role } = useAuth();

  const { data: modulos, isLoading } = useQuery({
    queryKey: ['modulos-activos', role],
    enabled: !!role,
    queryFn: async () => {
      const roleName = ROLE_NAME_MAP[role ?? 'user'] ?? ROLE_NAME_MAP.user;

      const { data: rol, error: rolError } = await supabase
        .from('roles_custom')
        .select('id')
        .eq('nombre', roleName)
        .maybeSingle();

      if (rolError) throw rolError;

      const { data: modulosData, error: modulosError } = await supabase
        .from('modulos')
        .select('id, clave, ruta, activo')
        .order('orden');

      if (modulosError) throw modulosError;

      if (!rol?.id) {
        return ((modulosData ?? []) as ModuloRow[]).map((modulo) => ({
          ...modulo,
          canView: modulo.activo,
        }));
      }

      const { data: permisosData, error: permisosError } = await supabase
        .from('rol_permisos')
        .select('modulo_id, ver')
        .eq('rol_id', rol.id);

      if (permisosError) throw permisosError;

      const permisosPorModulo = new Map(
        ((permisosData ?? []) as PermisoRow[]).map((permiso) => [permiso.modulo_id, permiso.ver])
      );

      return ((modulosData ?? []) as ModuloRow[]).map((modulo) => ({
        ...modulo,
        canView: modulo.activo && Boolean(permisosPorModulo.get(modulo.id)),
      }));
    },
    staleTime: 60_000,
  });

  const rutasActivas = new Set(
    (modulos ?? []).filter((m) => m.canView).map((m) => m.ruta).filter(Boolean)
  );

  const isModuloActivo = (ruta: string) => rutasActivas.has(ruta);

  return { modulos: modulos ?? [], isLoading, isModuloActivo, rutasActivas };
}
