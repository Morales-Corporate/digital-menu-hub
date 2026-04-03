import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useModulosActivos() {
  const { data: modulos, isLoading } = useQuery({
    queryKey: ['modulos-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos')
        .select('clave, ruta, activo')
        .order('orden');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const rutasActivas = new Set(
    (modulos ?? []).filter(m => m.activo).map(m => m.ruta).filter(Boolean)
  );

  const isModuloActivo = (ruta: string) => rutasActivas.has(ruta);

  return { modulos: modulos ?? [], isLoading, isModuloActivo, rutasActivas };
}
