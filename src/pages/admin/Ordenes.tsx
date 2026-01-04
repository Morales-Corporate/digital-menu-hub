import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, Clock, Eye, RefreshCw, Image as ImageIcon, Truck, Package, 
  MapPin, Phone, User, Banknote, CreditCard, QrCode, XCircle, AlertTriangle,
  Calendar, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInMinutes, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

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
  user_id: string;
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

const ORDER_STATES = ['pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado'] as const;
type OrderState = typeof ORDER_STATES[number];

const STATE_CONFIG: Record<OrderState, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-800', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  confirmado: { label: 'Confirmado', icon: CheckCircle, color: 'text-blue-800', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  en_camino: { label: 'En Camino', icon: Truck, color: 'text-purple-800', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
  entregado: { label: 'Entregado', icon: Package, color: 'text-green-800', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
  cancelado: { label: 'Cancelado', icon: XCircle, color: 'text-red-800', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
};

export default function Ordenes() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pendiente');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCierreCaja, setShowCierreCaja] = useState(false);
  const [cierreDate, setCierreDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [, setCurrentTime] = useState(new Date());

  // Update current time every minute to refresh wait time indicators
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
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
      
      const userIds = [...new Set(ordersData?.map(o => o.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, telefono, direccion, referencia_direccion, latitud, longitud')
        .in('id', userIds);
      
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const ordersWithProfiles = ordersData?.map(order => ({
        ...order,
        profiles: profilesMap.get(order.user_id) || null
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

  const handleUpdateStatus = async (orderId: string, newStatus: OrderState) => {
    try {
      const order = orders.find(o => o.id === orderId);
      
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

      const { error } = await supabase
        .from('ordenes')
        .update({ estado: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // If confirming, update points for the user
      if (newStatus === 'confirmado' && order) {
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
      default: return { label: metodo, icon: DollarSign, color: 'text-muted-foreground' };
    }
  };

  const getNextStatus = (currentStatus: string): Exclude<OrderState, 'cancelado'> | null => {
    if (currentStatus === 'cancelado') return null;
    const validStates: Exclude<OrderState, 'cancelado'>[] = ['pendiente', 'confirmado', 'en_camino', 'entregado'];
    const currentIndex = validStates.indexOf(currentStatus as Exclude<OrderState, 'cancelado'>);
    if (currentIndex === -1 || currentIndex >= validStates.length - 1) return null;
    return validStates[currentIndex + 1];
  };

  const getNextStatusButton = (order: Order) => {
    const nextStatus = getNextStatus(order.estado);
    if (!nextStatus) return null;

    const config = STATE_CONFIG[nextStatus as OrderState];
    const Icon = config.icon;
    
    return (
      <Button size="sm" onClick={() => handleUpdateStatus(order.id, nextStatus)}>
        <Icon className="h-4 w-4 mr-1" /> {config.label}
      </Button>
    );
  };

  // Cierre de Caja calculations
  const getCierreData = () => {
    const selectedDate = parseISO(cierreDate);
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    const dayOrders = orders.filter(order => {
      const orderDate = parseISO(order.created_at);
      return orderDate >= dayStart && orderDate <= dayEnd && order.estado === 'entregado';
    });

    const totalVentas = dayOrders.reduce((sum, order) => sum + order.total, 0);
    const cantidadPedidos = dayOrders.length;

    const porMetodo = {
      yape_plin: dayOrders.filter(o => o.metodo_pago === 'yape_plin').reduce((sum, o) => sum + o.total, 0),
      efectivo: dayOrders.filter(o => o.metodo_pago === 'efectivo').reduce((sum, o) => sum + o.total, 0),
      tarjeta: dayOrders.filter(o => o.metodo_pago === 'tarjeta').reduce((sum, o) => sum + o.total, 0),
    };

    const cantidadPorMetodo = {
      yape_plin: dayOrders.filter(o => o.metodo_pago === 'yape_plin').length,
      efectivo: dayOrders.filter(o => o.metodo_pago === 'efectivo').length,
      tarjeta: dayOrders.filter(o => o.metodo_pago === 'tarjeta').length,
    };

    return { totalVentas, cantidadPedidos, porMetodo, cantidadPorMetodo, dayOrders };
  };

  const filteredOrders = orders.filter(order => order.estado === activeTab);

  const OrderTable = ({ orders }: { orders: Order[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orden</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Fecha/Hora</TableHead>
          <TableHead>Pago</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const paymentInfo = getPaymentMethodDisplay(order.metodo_pago);
          const PaymentIcon = paymentInfo.icon;
          const waitFlag = getWaitTimeFlag(order);
          
          return (
            <TableRow key={order.id} className={waitFlag ? 'bg-orange-50' : ''}>
              <TableCell className="font-mono text-sm">
                <div className="flex items-center gap-2">
                  {order.id.slice(0, 8)}
                  {waitFlag}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{order.profiles?.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">{order.profiles?.telefono}</p>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p>{format(new Date(order.created_at), 'dd/MM/yyyy', { locale: es })}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), 'HH:mm', { locale: es })}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <PaymentIcon className={`h-4 w-4 ${paymentInfo.color}`} />
                  <span className="text-sm">{paymentInfo.label}</span>
                </div>
              </TableCell>
              <TableCell className="font-medium">S/ {order.total.toFixed(2)}</TableCell>
              <TableCell>{getStatusBadge(order.estado)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end flex-wrap">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Detalle del Pedido</DialogTitle>
                      </DialogHeader>
                      {selectedOrder && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="col-span-2 bg-secondary/50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-primary" />
                                <span className="font-medium">Datos del Cliente</span>
                              </div>
                              <p className="font-semibold text-lg">{selectedOrder.profiles?.full_name || 'Sin nombre'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> Teléfono
                              </p>
                              <p className="font-medium">{selectedOrder.profiles?.telefono || '-'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Método de pago</p>
                              <div className="flex items-center gap-2 font-medium">
                                {selectedOrder.metodo_pago === 'yape_plin' && <QrCode className="h-4 w-4 text-primary" />}
                                {selectedOrder.metodo_pago === 'efectivo' && <Banknote className="h-4 w-4 text-green-600" />}
                                {selectedOrder.metodo_pago === 'tarjeta' && <CreditCard className="h-4 w-4 text-blue-600" />}
                                {selectedOrder.metodo_pago === 'yape_plin' ? 'Yape/Plin' : 
                                 selectedOrder.metodo_pago === 'efectivo' ? 'Efectivo' : 
                                 selectedOrder.metodo_pago === 'tarjeta' ? 'Tarjeta (POS)' : selectedOrder.metodo_pago}
                              </div>
                            </div>
                            {selectedOrder.metodo_pago === 'efectivo' && selectedOrder.monto_pago && (
                              <div className="col-span-2 bg-green-50 p-3 rounded-lg border border-green-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-muted-foreground text-xs">Cliente paga con</p>
                                    <p className="font-bold text-lg">S/ {selectedOrder.monto_pago.toFixed(2)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-muted-foreground text-xs">Vuelto a llevar</p>
                                    <p className="text-green-600 font-bold text-lg">
                                      S/ {(selectedOrder.monto_pago - selectedOrder.total).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="col-span-2">
                              <p className="text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Dirección de entrega
                              </p>
                              <p className="font-medium">{selectedOrder.profiles?.direccion || 'Sin dirección'}</p>
                              {selectedOrder.profiles?.referencia_direccion && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  Ref: {selectedOrder.profiles.referencia_direccion}
                                </p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <p className="text-muted-foreground">Estado</p>
                              {getStatusBadge(selectedOrder.estado)}
                            </div>
                            {selectedOrder.estado === 'cancelado' && selectedOrder.motivo_cancelacion && (
                              <div className="col-span-2 bg-red-50 p-3 rounded-lg border border-red-200">
                                <p className="text-sm text-red-800 font-medium">Motivo de cancelación:</p>
                                <p className="text-sm text-red-700">{selectedOrder.motivo_cancelacion}</p>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-2">Productos</p>
                            <div className="space-y-2">
                              {selectedOrder.orden_items.map(item => (
                                <div key={item.id} className="flex justify-between py-2 border-b">
                                  <span>{item.productos?.nombre || 'Producto eliminado'} x{item.cantidad}</span>
                                  <span>S/ {(item.precio_unitario * item.cantidad).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between font-bold text-lg">
                            <span>Total:</span>
                            <span>S/ {selectedOrder.total.toFixed(2)}</span>
                          </div>
                          {selectedOrder.comprobante_pago && (selectedOrder.estado === 'pendiente' || selectedOrder.estado === 'confirmado') && (
                            <Button 
                              variant="outline" 
                              className="w-full mt-4"
                              onClick={() => handleViewReceipt(selectedOrder.comprobante_pago!)}
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Ver Comprobante de Pago
                            </Button>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  {order.comprobante_pago && (order.estado === 'pendiente' || order.estado === 'confirmado') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewReceipt(order.comprobante_pago!)}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {order.estado !== 'entregado' && order.estado !== 'cancelado' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => openCancelDialog(order.id)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {getNextStatusButton(order)}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const cierreData = getCierreData();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Gestión de Pedidos</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCierreCaja(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Cierre de Caja
            </Button>
            <Button variant="outline" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            {ORDER_STATES.map(state => {
              const config = STATE_CONFIG[state];
              const count = orders.filter(o => o.estado === state).length;
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

          {ORDER_STATES.map(state => (
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

        {/* Cierre de Caja dialog */}
        <Dialog open={showCierreCaja} onOpenChange={setShowCierreCaja}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Cierre de Caja
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={cierreDate}
                  onChange={(e) => setCierreDate(e.target.value)}
                  className="w-auto"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Ventas</p>
                    <p className="text-2xl font-bold text-primary">S/ {cierreData.totalVentas.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Pedidos Entregados</p>
                    <p className="text-2xl font-bold">{cierreData.cantidadPedidos}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="font-medium mb-3">Desglose por Método de Pago</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-primary" />
                      <span>Yape/Plin</span>
                      <Badge variant="outline">{cierreData.cantidadPorMetodo.yape_plin} pedidos</Badge>
                    </div>
                    <span className="font-bold">S/ {cierreData.porMetodo.yape_plin.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-green-600" />
                      <span>Efectivo</span>
                      <Badge variant="outline">{cierreData.cantidadPorMetodo.efectivo} pedidos</Badge>
                    </div>
                    <span className="font-bold">S/ {cierreData.porMetodo.efectivo.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <span>Tarjeta (POS)</span>
                      <Badge variant="outline">{cierreData.cantidadPorMetodo.tarjeta} pedidos</Badge>
                    </div>
                    <span className="font-bold">S/ {cierreData.porMetodo.tarjeta.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {cierreData.dayOrders.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Detalle de pedidos</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {cierreData.dayOrders.map(order => (
                      <div key={order.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                        <span className="font-mono">{order.id.slice(0, 8)}</span>
                        <span>{format(parseISO(order.created_at), 'HH:mm')}</span>
                        <span className="font-medium">S/ {order.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}