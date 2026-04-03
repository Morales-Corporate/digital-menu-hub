import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessConfig {
  tipo_negocio: string;
  estados_pedido_visibles: string[];
}

const DEFAULT_CONFIG: BusinessConfig = {
  tipo_negocio: 'restaurante',
  estados_pedido_visibles: ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'pagado'],
};

export function useBusinessConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ['business-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracion_empresa')
        .select('tipo_negocio, estados_pedido_visibles')
        .maybeSingle();
      if (error) throw error;
      return data as BusinessConfig | null;
    },
    staleTime: 60_000,
  });

  const config = data ?? DEFAULT_CONFIG;

  const isEstadoVisible = (estado: string) =>
    config.estados_pedido_visibles.includes(estado);

  return {
    config,
    isLoading,
    isEstadoVisible,
    estadosVisibles: config.estados_pedido_visibles,
    tipoNegocio: config.tipo_negocio,
  };
}
