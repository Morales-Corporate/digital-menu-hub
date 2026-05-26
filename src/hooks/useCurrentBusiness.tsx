import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type BusinessPlan = 'trial' | 'basic' | 'pro' | 'enterprise';
export type BusinessStatus = 'active' | 'expired' | 'suspended' | 'cancelled';

export interface BusinessRow {
  id: string;
  name: string;
  slug: string | null;
  plan: BusinessPlan;
  status: BusinessStatus;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  feature_flags: Record<string, boolean> | null;
  is_default: boolean;
}

export function useCurrentBusiness() {
  const { user } = useAuth();

  const { data: business, isLoading } = useQuery({
    queryKey: ['current-business', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: membership } = await (supabase as any)
        .from('business_users')
        .select('business_id, role_in_business')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const bizId = membership?.business_id;
      if (!bizId) return null;

      const { data: biz } = await (supabase as any)
        .from('businesses')
        .select('*')
        .eq('id', bizId)
        .maybeSingle();

      return biz
        ? ({ ...biz, role_in_business: membership.role_in_business } as BusinessRow & { role_in_business: 'owner' | 'staff' })
        : null;
    },
    staleTime: 60_000,
  });

  const now = Date.now();
  const trialEnd = business?.trial_ends_at ? new Date(business.trial_ends_at).getTime() : null;
  const subEnd = business?.subscription_ends_at ? new Date(business.subscription_ends_at).getTime() : null;

  const isTrial = business?.plan === 'trial';
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : null;
  const subDaysLeft = subEnd ? Math.max(0, Math.ceil((subEnd - now) / 86400000)) : null;

  const isExpired =
    !!business &&
    (business.status !== 'active' ||
      (subEnd !== null && subEnd <= now) ||
      (isTrial && trialEnd !== null && trialEnd <= now));

  const isSuspended = business?.status === 'suspended' || business?.status === 'cancelled';
  const canWrite = !!business && !isExpired && !isSuspended;

  const hasFeature = (key: string) => {
    if (!business) return false;
    const flags = business.feature_flags || {};
    if (key in flags) return !!flags[key];
    // sensible defaults by plan
    if (business.plan === 'pro' || business.plan === 'enterprise') return true;
    return false;
  };

  return {
    business: business ?? null,
    isLoading,
    isTrial,
    isExpired,
    isSuspended,
    canWrite,
    trialDaysLeft,
    subDaysLeft,
    hasFeature,
  };
}
