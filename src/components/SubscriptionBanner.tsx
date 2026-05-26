import { AlertCircle, Clock, Sparkles } from 'lucide-react';
import { useCurrentBusiness } from '@/hooks/useCurrentBusiness';
import { cn } from '@/lib/utils';

export default function SubscriptionBanner() {
  const { business, isTrial, isExpired, isSuspended, trialDaysLeft, subDaysLeft } = useCurrentBusiness();

  if (!business) return null;

  if (isExpired || isSuspended) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/30 text-destructive px-4 py-2.5 flex items-center gap-2 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Tu suscripción ha expirado. Renueva tu plan para continuar operando. El sistema está en modo solo lectura.
        </span>
      </div>
    );
  }

  if (isTrial && trialDaysLeft !== null) {
    const urgent = trialDaysLeft <= 3;
    const warn = trialDaysLeft <= 7;
    return (
      <div
        className={cn(
          'border-b px-4 py-2.5 flex items-center gap-2 text-sm',
          urgent
            ? 'bg-destructive/10 border-destructive/30 text-destructive'
            : warn
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
            : 'bg-primary/10 border-primary/20 text-primary'
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Período de prueba: {trialDaysLeft} {trialDaysLeft === 1 ? 'día restante' : 'días restantes'}
        </span>
      </div>
    );
  }

  if (subDaysLeft !== null && subDaysLeft <= 7) {
    return (
      <div className="bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-4 py-2.5 flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Tu suscripción vence en {subDaysLeft} {subDaysLeft === 1 ? 'día' : 'días'}. Renueva pronto para evitar interrupciones.
        </span>
      </div>
    );
  }

  return null;
}
