import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import OrderCard, { getOrderTipo, tipoConfig, OrderTipo } from '@/components/admin/OrderCard';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  CheckCircle, Clock, Eye, RefreshCw, Image as ImageIcon, Truck, Package, 
  MapPin, Phone, User, Banknote, CreditCard, QrCode, XCircle, AlertTriangle,
  DollarSign, UtensilsCrossed, Users, Plus, Wallet, FileText, ChefHat
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
import CrearPedidoModal from '@/components/admin/CrearPedidoModal';
import EmitirComprobanteModal from '@/components/admin/EmitirComprobanteModal';

interface OrderItem {
  id: string;
  cantidad: number;
  precio_unitario: number;
  productos: {
    nombre: string;
  } | null;
}

interface Order {
  id: string;
  created_at: string;
  total: number;
  estado: string;
  metodo_pago: string;
  puntos_ganados: number;
  comprobante_pago: string | null;
  monto_pago: number | null;
  motivo_cancelacion: string | null;
  user_id: string | null;
  es_invitado: boolean;
  nombre_invitado: string | null;
  telefono_invitado: string | null;
  numero_mesa: number | null;
  mesero_id: string | null;
  entregado_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    referencia_direccion: string | null;
    latitud: number | null;
    longitud: number | null;
  } | null;
  orden_items: OrderItem[];
}

const ORDER_STATES = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'en_camino', 'entregado', 'cancelado'] as const;
type OrderState = typeof ORDER_STATES[number];

const STATE_CONFIG: Record<OrderState, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-800', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  confirmado: { label: 'Confirmado', icon: CheckCircle, color: 'text-blue-800', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  en_preparacion: { label: 'En Preparación', icon: UtensilsCrossed, color: 'text-orange-800', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  listo: { label: 'Listo', icon: ChefHat, color: 'text-teal-800', bgColor: 'bg-teal-100', borderColor: 'border-teal-300' },
  en_camino: { label: 'En Camino', icon: Truck, color: 'text-purple-800', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
  entregado: { label: 'Entregado', icon: Package, color: 'text-green-800', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
  cancelado: { label: 'Cancelado', icon: XCircle, color: 'text-red-800', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
};

export default function Ordenes() {
  const { isEstadoVisible, estadosVisibles } = useBusinessConfig();
  const visibleOrderStates = ORDER_STATES.filter(s => s === 'cancelado' || isEstadoVisible(s));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pendiente');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [, setCurrentTime] = useState(new Date());
  const [meseroDialogOpen, setMeseroDialogOpen] = useState(false);
  const [selectedOrderForMesero, setSelectedOrderForMesero] = useState<string | null>(null);
  const [selectedMeseroId, setSelectedMeseroId] = useState<string>('');
  const [crearPedidoOpen, setCrearPedidoOpen] = useState(false);
  
  // Payment dialog state for orders with pago_pendiente
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('efectivo');
  
  // Comprobante emission state
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [ordenParaComprobante, setOrdenParaComprobante] = useState<Order | null>(null);

  // Fetch meseros activos
  const { data: meseros = [] } = useQuery({
    queryKey: ['meseros-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meseros')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    }
  });

  // Fetch asignaciones de mesas de hoy
  const { data: asignacionesHoy = [] } = useQuery({
    queryKey: ['asignaciones-hoy'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const currentHour = new Date().getHours();
      const turno = currentHour < 16 ? 'dia' : 'noche';
      
      const { data, error } = await supabase
        .from('asignacion_mesas')
        .select('*, meseros(nombre)')
        .eq('fecha', today)
        .eq('turno', turno);
      if (error) throw error;
      return data;
    }
  });

  // Helper to get mesero assigned to a table
  const getMeseroForMesa = (numeroMesa: number | null) => {
    if (!numeroMesa) return null;
    const asignacion = asignacionesHoy.find(
      a => numeroMesa >= a.mesa_inicio && numeroMesa <= a.mesa_fin
    );
    return asignacion ? { id: asignacion.mesero_id, nombre: asignacion.meseros?.nombre } : null;
  };

  // Update current time every minute to refresh wait time indicators
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // First, get closed dates to filter out closed orders
      const { data: cierresData } = await supabase
        .from('cierres_caja')
        .select('fecha');
      
      const fechasCerradas = cierresData?.map(c => c.fecha) || [];
      setClosedDates(fechasCerradas);

      const { data: ordersData, error: ordersError } = await supabase
        .from('ordenes')
        .select(`
          *,
          orden_items (
            id,
            cantidad,
            precio_unitario,
            productos (nombre)
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      
      // Filter out null user_ids for profile lookup
      const userIds = [...new Set(ordersData?.filter(o => o.user_id).map(o => o.user_id) || [])];
      const { data: profilesData } = userIds.length > 0 
        ? await supabase
            .from('profiles')
            .select('id, full_name, email, telefono, direccion, referencia_direccion, latitud, longitud')
            .in('id', userIds)
        : { data: [] };
      
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p] as const));
      
      const ordersWithProfiles = ordersData?.map(order => ({
        ...order,
        profiles: order.user_id ? profilesMap.get(order.user_id) || null : null
      })) || [];
      
      setOrders(ordersWithProfiles as Order[]);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderState, paymentMethod?: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      
      // Check if order has pending payment and is being marked as delivered
      if (newStatus === 'entregado' && order?.metodo_pago === 'pago_pendiente' && !paymentMethod) {
        // Open payment dialog instead of directly updating
        setPaymentOrderId(orderId);
        setSelectedPaymentMethod('efectivo');
        setShowPaymentDialog(true);
        return;
      }
      
      // If confirming, decrement stock for each product
      if (newStatus === 'confirmado' && order) {
        for (const item of order.orden_items) {
          if (item.productos) {
            // Get product ID from the order item - need to fetch it
            const { data: orderItemData } = await supabase
              .from('orden_items')
              .select('producto_id')
              .eq('id', item.id)
              .single();

            if (orderItemData?.producto_id) {
              // Get current stock
              const { data: producto } = await supabase
                .from('productos')
                .select('stock')
                .eq('id', orderItemData.producto_id)
                .single();

              // Only decrement if stock is not null (null = unlimited)
              if (producto?.stock !== null) {
                const newStock = Math.max(0, producto.stock - item.cantidad);
                await supabase
                  .from('productos')
                  .update({ stock: newStock })
                  .eq('id', orderItemData.producto_id);
              }
            }
          }
        }
      }

      // Build update object - include entregado_at if marking as delivered
      const updateData: { estado: string; entregado_at?: string; metodo_pago?: string } = { estado: newStatus };
      if (newStatus === 'entregado') {
        updateData.entregado_at = new Date().toISOString();
        // If payment method provided (from dialog), update it
        if (paymentMethod) {
          updateData.metodo_pago = paymentMethod;
        }
      }

      const { error } = await supabase
        .from('ordenes')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // If confirming, update points for the user
      if (newStatus === 'confirmado' && order && order.user_id) {
        const { data: existingPoints } = await supabase
          .from('puntos_usuario')
          .select('*')
          .eq('user_id', order.user_id)
          .maybeSingle();

        if (existingPoints) {
          await supabase
            .from('puntos_usuario')
            .update({ 
              puntos_totales: existingPoints.puntos_totales + order.puntos_ganados 
            })
            .eq('user_id', order.user_id);
        } else {
          await supabase
            .from('puntos_usuario')
            .insert({
              user_id: order.user_id,
              puntos_totales: order.puntos_ganados
            });
        }
      }

      toast.success(`Pedido actualizado a: ${STATE_CONFIG[newStatus].label}`);
      fetchOrders();
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar pedido');
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentOrderId || !selectedPaymentMethod) return;
    
    setShowPaymentDialog(false);
    await handleUpdateStatus(paymentOrderId, 'entregado', selectedPaymentMethod);
    setPaymentOrderId(null);
    setSelectedPaymentMethod('efectivo');
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId || !cancelReason.trim()) {
      toast.error('Por favor ingresa el motivo de cancelación');
      return;
    }

    try {
      const { error } = await supabase
        .from('ordenes')
        .update({ 
          estado: 'cancelado',
          motivo_cancelacion: cancelReason.trim()
        })
        .eq('id', cancelOrderId);

      if (error) throw error;

      toast.success('Pedido cancelado');
      setShowCancelDialog(false);
      setCancelOrderId(null);
      setCancelReason('');
      fetchOrders();
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      toast.error('Error al cancelar pedido');
    }
  };

  const openCancelDialog = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason('');
    setShowCancelDialog(true);
  };

  const openMeseroDialog = (orderId: string, currentMeseroId: string | null) => {
    setSelectedOrderForMesero(orderId);
    setSelectedMeseroId(currentMeseroId || '');
    setMeseroDialogOpen(true);
  };

  const handleAssignMesero = async () => {
    if (!selectedOrderForMesero) return;
    
    try {
      const meseroIdToSave = selectedMeseroId === 'none' ? null : selectedMeseroId || null;
      
      const { error } = await supabase
        .from('ordenes')
        .update({ mesero_id: meseroIdToSave })
        .eq('id', selectedOrderForMesero);

      if (error) throw error;

      toast.success(meseroIdToSave ? 'Mesero asignado' : 'Mesero removido');
      setMeseroDialogOpen(false);
      setSelectedOrderForMesero(null);
      setSelectedMeseroId('');
      fetchOrders();
    } catch (error: any) {
      console.error('Error assigning mesero:', error);
      toast.error('Error al asignar mesero');
    }
  };

  const getMeseroName = (meseroId: string | null) => {
    if (!meseroId) return null;
    const mesero = meseros.find(m => m.id === meseroId);
    return mesero?.nombre || null;
  };

  const handleViewReceipt = async (comprobantePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('comprobantes-pago')
        .createSignedUrl(comprobantePath, 300);

      if (data?.signedUrl) {
        setReceiptUrl(data.signedUrl);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error('Error getting receipt:', error);
      toast.error('Error al cargar comprobante');
    }
  };

  const getWaitTimeFlag = (order: Order) => {
    if (order.estado !== 'pendiente') return null;
    
    const waitMinutes = differenceInMinutes(new Date(), parseISO(order.created_at));
    
    if (waitMinutes >= 25) {
      return (
        <Badge variant="destructive" className="animate-pulse">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {waitMinutes} min
        </Badge>
      );
    } else if (waitMinutes >= 15) {
      return (
        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
          <Clock className="h-3 w-3 mr-1" />
          {waitMinutes} min
        </Badge>
      );
    }
    return null;
  };

  const getStatusBadge = (estado: string) => {
    const config = STATE_CONFIG[estado as OrderState] || STATE_CONFIG.pendiente;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} ${config.borderColor}`}>
        <Icon className="h-3 w-3 mr-1" /> {config.label}
      </Badge>
    );
  };

  const getPaymentMethodDisplay = (metodo: string) => {
    switch (metodo) {
      case 'yape_plin': return { label: 'Yape/Plin', icon: QrCode, color: 'text-primary' };
      case 'efectivo': return { label: 'Efectivo', icon: Banknote, color: 'text-green-600' };
      case 'tarjeta': return { label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600' };
      case 'pago_pendiente': return { label: 'Pendiente', icon: Wallet, color: 'text-amber-600' };
      default: return { label: metodo, icon: DollarSign, color: 'text-muted-foreground' };
    }
  };

  const getNextStatus = (currentStatus: string, order: Order): Exclude<OrderState, 'cancelado'> | null => {
    if (currentStatus === 'cancelado') return null;
    
    // Different flow for mesa orders vs delivery orders
    const isMesaOrder = order.numero_mesa !== null;
    
    // Build valid states from visible states, excluding cancelado
    const baseStates: Exclude<OrderState, 'cancelado'>[] = isMesaOrder
      ? (['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado'] as const).filter(s => isEstadoVisible(s)) as Exclude<OrderState, 'cancelado'>[]
      : (['pendiente', 'confirmado', 'en_preparacion', 'listo', 'en_camino', 'entregado'] as const).filter(s => isEstadoVisible(s)) as Exclude<OrderState, 'cancelado'>[];
    
    const currentIndex = baseStates.indexOf(currentStatus as Exclude<OrderState, 'cancelado'>);
    if (currentIndex === -1 || currentIndex >= baseStates.length - 1) return null;
    return baseStates[currentIndex + 1];
  };

  const getNextStatusButton = (order: Order) => {
    const nextStatus = getNextStatus(order.estado, order);
    if (!nextStatus) return null;

    const config = STATE_CONFIG[nextStatus as OrderState];
    const Icon = config.icon;
    
    return (
      <Button size="sm" onClick={() => handleUpdateStatus(order.id, nextStatus)}>
        <Icon className="h-4 w-4 mr-1" /> {config.label}
      </Button>
    );
  };

  // Get current open caja session
  const { data: cajaAbiertaAdmin } = useQuery({
    queryKey: ['caja-abierta-ordenes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aperturas_caja')
        .select('id, fecha_apertura')
        .eq('estado', 'abierta')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Pedidos visibles: solo los creados después de la apertura de caja actual
  const visibleOrders = orders.filter((order) => {
    if (!cajaAbiertaAdmin?.fecha_apertura) return false;
    return new Date(order.created_at) >= new Date(cajaAbiertaAdmin.fecha_apertura);
  });

  const filteredOrders = visibleOrders.filter((order) => order.estado === activeTab);

  // (table view replaced by Kanban + OrderCard)

  // Calculate today's summary from visibleOrders
  const todaySales = visibleOrders
    .filter(o => o.estado === 'entregado')
    .reduce((sum, o) => sum + o.total, 0);
  const todayEntregados = visibleOrders.filter(o => o.estado === 'entregado').length;
  const todayPendientes = visibleOrders.filter(o => o.estado === 'pendiente').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header con resumen del día */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Pedidos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          
          {/* Mini resumen inline */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Ventas Hoy</p>
                <p className="text-sm font-bold">S/ {todaySales.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-green-100 px-3 py-2 rounded-lg">
              <Package className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Entregados</p>
                <p className="text-sm font-bold">{todayEntregados}</p>
              </div>
            </div>
            {todayPendientes > 0 && (
              <div className="flex items-center gap-2 bg-amber-100 px-3 py-2 rounded-lg animate-pulse">
                <Clock className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-[10px] text-muted-foreground leading-none">Pendientes</p>
                  <p className="text-sm font-bold text-amber-800">{todayPendientes}</p>
                </div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setCrearPedidoOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Crear Pedido</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${visibleOrderStates.length}, minmax(0, 1fr))` }}>
            {visibleOrderStates.map(state => {
              const config = STATE_CONFIG[state];
              const count = visibleOrders.filter(o => o.estado === state).length;
              return (
                <TabsTrigger key={state} value={state} className="relative text-xs sm:text-sm">
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden">{config.label.slice(0, 4)}</span>
                  {count > 0 && (
                    <span className={`ml-1 sm:ml-2 text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {visibleOrderStates.map(state => (
            <TabsContent key={state} value={state}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(() => {
                      const config = STATE_CONFIG[state];
                      const Icon = config.icon;
                      return <Icon className={`h-5 w-5 ${config.color}`} />;
                    })()}
                    Pedidos {STATE_CONFIG[state].label}s
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-center py-8 text-muted-foreground">Cargando pedidos...</p>
                  ) : filteredOrders.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No hay pedidos {STATE_CONFIG[state].label.toLowerCase()}s
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <OrderTable orders={filteredOrders} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Receipt viewer dialog */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Comprobante de Pago</DialogTitle>
            </DialogHeader>
            {receiptUrl && (
              <img 
                src={receiptUrl} 
                alt="Comprobante de pago" 
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel order dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" /> Cancelar Pedido
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Por favor indica el motivo de la cancelación. Esta información quedará registrada.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cancelReason">Motivo de cancelación *</Label>
                <Textarea
                  id="cancelReason"
                  placeholder="Ej: Cliente solicitó cancelar, problema con el pago, etc."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                Volver
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancelOrder}
                disabled={!cancelReason.trim()}
              >
                Confirmar Cancelación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign mesero dialog */}
        <Dialog open={meseroDialogOpen} onOpenChange={setMeseroDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Asignar Mesero
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Seleccionar Mesero</Label>
                <Select value={selectedMeseroId} onValueChange={setSelectedMeseroId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mesero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {meseros.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMeseroDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAssignMesero}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment method dialog for pago_pendiente orders */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Registrar Pago
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Selecciona el método de pago utilizado por el cliente:
              </p>
              <RadioGroup 
                value={selectedPaymentMethod} 
                onValueChange={setSelectedPaymentMethod}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <RadioGroupItem value="efectivo" id="efectivo" />
                  <Label htmlFor="efectivo" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Banknote className="h-5 w-5 text-green-600" />
                    Efectivo
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <RadioGroupItem value="yape_plin" id="yape_plin" />
                  <Label htmlFor="yape_plin" className="flex items-center gap-2 cursor-pointer flex-1">
                    <QrCode className="h-5 w-5 text-primary" />
                    Yape/Plin
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <RadioGroupItem value="tarjeta" id="tarjeta" />
                  <Label htmlFor="tarjeta" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Tarjeta (POS)
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmPayment}>
                Confirmar Entrega
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Crear pedido modal */}
        <CrearPedidoModal 
          open={crearPedidoOpen}
          onOpenChange={setCrearPedidoOpen}
          onOrderCreated={fetchOrders}
          meseros={meseros}
        />

        {/* Emitir comprobante modal */}
        <EmitirComprobanteModal
          open={showComprobanteModal}
          onOpenChange={setShowComprobanteModal}
          orden={ordenParaComprobante}
        />

      </div>
    </AdminLayout>
  );
}