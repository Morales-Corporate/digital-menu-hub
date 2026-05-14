import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye, Clock, AlertTriangle, ChevronRight, XCircle, FileText, Image as ImageIcon,
  UtensilsCrossed, Bike, ShoppingBag, Users, Banknote, CreditCard, QrCode, Wallet, DollarSign
} from 'lucide-react';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type OrderTipo = 'salon' | 'delivery' | 'takeaway';

export const tipoConfig: Record<OrderTipo, { label: string; icon: React.ElementType; className: string }> = {
  salon:    { label: 'Salón',    icon: UtensilsCrossed, className: 'bg-accent/15 text-accent border-accent/30' },
  delivery: { label: 'Delivery', icon: Bike,            className: 'bg-primary/15 text-primary border-primary/30' },
  takeaway: { label: 'Takeaway', icon: ShoppingBag,     className: 'bg-warning/15 text-warning-foreground border-warning/40' },
};

export function getOrderTipo(order: {
  numero_mesa: number | null;
  profiles: { direccion: string | null } | null;
  es_invitado: boolean;
}): OrderTipo {
  if (order.numero_mesa) return 'salon';
  if (order.profiles?.direccion) return 'delivery';
  return 'takeaway';
}

const paymentMap: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  yape_plin:      { label: 'Yape/Plin', icon: QrCode,      color: 'text-primary' },
  efectivo:       { label: 'Efectivo',  icon: Banknote,    color: 'text-success' },
  tarjeta:        { label: 'Tarjeta',   icon: CreditCard,  color: 'text-blue-600' },
  pago_pendiente: { label: 'Pendiente', icon: Wallet,      color: 'text-warning' },
};

interface OrderCardProps {
  order: any;
  meseroName?: string | null;
  isAutoMesero?: boolean;
  onView: () => void;
  onAdvance?: () => void;
  advanceLabel?: string;
  AdvanceIcon?: React.ElementType;
  onCancel?: () => void;
  onComprobante?: () => void;
  onViewReceipt?: () => void;
}

export default function OrderCard({
  order, meseroName, isAutoMesero,
  onView, onAdvance, advanceLabel, AdvanceIcon,
  onCancel, onComprobante, onViewReceipt,
}: OrderCardProps) {
  const tipo = getOrderTipo(order);
  const tipoCfg = tipoConfig[tipo];
  const TipoIcon = tipoCfg.icon;

  const minutes = differenceInMinutes(new Date(), parseISO(order.created_at));
  const isActive = !['entregado', 'cancelado'].includes(order.estado);

  let priority: 'normal' | 'warn' | 'danger' = 'normal';
  if (isActive) {
    if (minutes >= 25) priority = 'danger';
    else if (minutes >= 15) priority = 'warn';
  }

  const sideColor = {
    normal: 'bg-success',
    warn:   'bg-warning',
    danger: 'bg-destructive',
  }[priority];

  const pay = paymentMap[order.metodo_pago] ?? { label: order.metodo_pago, icon: DollarSign, color: 'text-muted-foreground' };
  const PayIcon = pay.icon;

  const customerName = order.es_invitado
    ? (order.nombre_invitado || 'Invitado')
    : (order.profiles?.full_name || 'Sin nombre');

  const itemsCount = order.orden_items?.reduce((s: number, i: any) => s + (i.cantidad || 0), 0) || 0;
  const summary = order.orden_items?.slice(0, 2).map((i: any) =>
    `${i.cantidad}× ${i.productos?.nombre ?? 'Producto'}`
  ).join(' · ');
  const extra = (order.orden_items?.length || 0) - 2;

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all">
      {/* Priority side bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', sideColor)} />

      <div className="pl-3 pr-3 py-3 space-y-2.5">
        {/* Header: # order + tipo + time */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-tight">
                #{order.id.slice(0, 6).toUpperCase()}
              </span>
              <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] gap-1', tipoCfg.className)}>
                <TipoIcon className="h-3 w-3" />
                {tipoCfg.label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {order.numero_mesa ? `Mesa ${order.numero_mesa} · ` : ''}{customerName}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">
              {format(parseISO(order.created_at), 'HH:mm', { locale: es })}
            </div>
            <div className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium mt-0.5 rounded px-1.5 py-0.5',
              priority === 'danger' && 'bg-destructive/10 text-destructive animate-pulse',
              priority === 'warn'   && 'bg-warning/15 text-warning-foreground',
              priority === 'normal' && 'text-muted-foreground',
            )}>
              {priority === 'danger' ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {minutes}m
            </div>
          </div>
        </div>

        {/* Items summary */}
        <div className="text-xs text-foreground/80 leading-snug">
          <span className="font-medium text-muted-foreground mr-1">{itemsCount} ítems:</span>
          {summary}{extra > 0 && <span className="text-muted-foreground"> +{extra} más</span>}
        </div>

        {/* Footer row: total + payment + mesero */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-bold text-base">S/ {Number(order.total).toFixed(2)}</span>
            <span className={cn('flex items-center gap-1 text-[11px]', pay.color)}>
              <PayIcon className="h-3 w-3" />
              {pay.label}
            </span>
          </div>
          {meseroName && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
              <Users className="h-3 w-3" />
              {meseroName}{isAutoMesero && ' ·auto'}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {onViewReceipt && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onViewReceipt}>
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          {onComprobante && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onComprobante}>
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onCancel}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          {onAdvance && advanceLabel && (
            <Button size="sm" className="h-8 ml-auto text-xs" onClick={onAdvance}>
              {AdvanceIcon && <AdvanceIcon className="h-3.5 w-3.5 mr-1" />}
              {advanceLabel}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
