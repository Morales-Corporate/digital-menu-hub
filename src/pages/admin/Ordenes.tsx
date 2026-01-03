import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, Clock, Eye, RefreshCw, Image as ImageIcon, X } from 'lucide-react';
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
  } | null;
  orden_items: OrderItem[];
}

export default function Ordenes() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetch orders first
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
      
      // Fetch profiles for each order
      const userIds = [...new Set(ordersData?.map(o => o.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
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

    // Real-time subscription for new orders
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

  const handleConfirmOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('ordenes')
        .update({ estado: 'confirmado' })
        .eq('id', orderId);

      if (error) throw error;

      // Update points for the user
      const order = orders.find(o => o.id === orderId);
      if (order) {
        // Check if user already has points record
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

      toast.success('Pedido confirmado');
      fetchOrders();
    } catch (error: any) {
      console.error('Error confirming order:', error);
      toast.error('Error al confirmar pedido');
    }
  };

  const handleViewReceipt = async (comprobantePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('comprobantes-pago')
        .createSignedUrl(comprobantePath, 300); // 5 min expiry

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
    switch (estado) {
      case 'pendiente':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>;
      case 'confirmado':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" /> Confirmado</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestión de Pedidos</h1>
        <Button variant="outline" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Cargando pedidos...</p>
          ) : orders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay pedidos aún</p>
          ) : (
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
                        <p className="text-xs text-muted-foreground">{order.profiles?.email}</p>
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
                          <DialogContent>
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
                                    <p className="text-muted-foreground">Método de pago</p>
                                    <p className="font-medium uppercase">{selectedOrder.metodo_pago}</p>
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
                        {order.estado === 'pendiente' && (
                          <Button size="sm" onClick={() => handleConfirmOrder(order.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Confirmar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
  );
}
