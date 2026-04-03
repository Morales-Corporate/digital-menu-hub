import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ModuloRow {
  clave: string;
  ruta: string | null;
  activo: boolean;
  rol_permisos?: { ver: boolean }[];
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

      const { data, error } = await supabase
        .from('modulos')
        .select(`
          clave,
          ruta,
          activo,
          rol_permisos!left(ver)
        `)
        .order('orden');

      if (error) throw error;

      return ((data ?? []) as unknown as ModuloRow[]).map((modulo) => {
        const canViewByRole = !rol
          ? true
          : modulo.rol_permisos?.some((permiso) => permiso.ver) ?? false;

        return {
          ...modulo,
          canView: modulo.activo && canViewByRole,
        };
      });
    },
    staleTime: 60_000,
  });

  const rutasActivas = new Set(
    (modulos ?? []).filter(m => m.canView).map(m => m.ruta).filter(Boolean)
  );

  const isModuloActivo = (ruta: string) => rutasActivas.has(ruta);

  return { modulos: modulos ?? [], isLoading, isModuloActivo, rutasActivas };
}
