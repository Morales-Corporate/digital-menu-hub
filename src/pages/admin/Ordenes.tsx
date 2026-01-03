import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, Eye, RefreshCw, Image as ImageIcon, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
  } | null;
  orden_items: OrderItem[];
}

const ORDER_STATES = ['pendiente', 'confirmado', 'en_camino', 'entregado'] as const;
type OrderState = typeof ORDER_STATES[number];

const STATE_CONFIG: Record<OrderState, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-800', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  confirmado: { label: 'Confirmado', icon: CheckCircle, color: 'text-blue-800', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  en_camino: { label: 'En Camino', icon: Truck, color: 'text-purple-800', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
  entregado: { label: 'Entregado', icon: Package, color: 'text-green-800', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
};

export default function Ordenes() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pendiente');

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
        .select('id, full_name, email, telefono, direccion')
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
      const { error } = await supabase
        .from('ordenes')
        .update({ estado: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // If confirming, update points for the user
      if (newStatus === 'confirmado') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
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
      }

      toast.success(`Pedido actualizado a: ${STATE_CONFIG[newStatus].label}`);
      fetchOrders();
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar pedido');
    }
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

  const getStatusBadge = (estado: string) => {
    const config = STATE_CONFIG[estado as OrderState] || STATE_CONFIG.pendiente;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} ${config.borderColor}`}>
        <Icon className="h-3 w-3 mr-1" /> {config.label}
      </Badge>
    );
  };

  const getNextStatus = (currentStatus: string): OrderState | null => {
    const currentIndex = ORDER_STATES.indexOf(currentStatus as OrderState);
    if (currentIndex === -1 || currentIndex >= ORDER_STATES.length - 1) return null;
    return ORDER_STATES[currentIndex + 1];
  };

  const getNextStatusButton = (order: Order) => {
    const nextStatus = getNextStatus(order.estado);
    if (!nextStatus) return null;

    const config = STATE_CONFIG[nextStatus];
    const Icon = config.icon;
    
    return (
      <Button size="sm" onClick={() => handleUpdateStatus(order.id, nextStatus)}>
        <Icon className="h-4 w-4 mr-1" /> {config.label}
      </Button>
    );
  };

  const filteredOrders = orders.filter(order => order.estado === activeTab);

  const OrderTable = ({ orders }: { orders: Order[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Orden</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Fecha/Hora</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono text-sm">
              {order.id.slice(0, 8)}
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
            <TableCell className="font-medium">S/ {order.total.toFixed(2)}</TableCell>
            <TableCell>{getStatusBadge(order.estado)}</TableCell>
            <TableCell className="text-right">
              <div className="flex gap-2 justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Detalle del Pedido</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Cliente</p>
                            <p className="font-medium">{selectedOrder.profiles?.full_name || 'Sin nombre'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Teléfono</p>
                            <p className="font-medium">{selectedOrder.profiles?.telefono || '-'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Dirección</p>
                            <p className="font-medium">{selectedOrder.profiles?.direccion || 'Sin dirección'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Método de pago</p>
                            <p className="font-medium uppercase">{selectedOrder.metodo_pago}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Estado</p>
                            {getStatusBadge(selectedOrder.estado)}
                          </div>
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
                        {selectedOrder.comprobante_pago && (
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
                {order.comprobante_pago && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleViewReceipt(order.comprobante_pago!)}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                )}
                {getNextStatusButton(order)}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Gestión de Pedidos</h1>
          <Button variant="outline" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {ORDER_STATES.map(state => {
              const config = STATE_CONFIG[state];
              const count = orders.filter(o => o.estado === state).length;
              return (
                <TabsTrigger key={state} value={state} className="relative">
                  {config.label}
                  {count > 0 && (
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
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
                    <OrderTable orders={filteredOrders} />
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
      </div>
    </AdminLayout>
  );
}