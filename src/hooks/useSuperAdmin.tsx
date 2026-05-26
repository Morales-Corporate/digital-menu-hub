import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useSuperAdmin() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('super_admins')
        .select('user_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
    staleTime: 5 * 60_000,
  });

  return { isSuperAdmin: !!data, isLoading };
}
