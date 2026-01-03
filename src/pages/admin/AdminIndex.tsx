import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle, 
  Truck, 
  Package,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderCounts {
  pendiente: number;
  confirmado: number;
  en_camino: number;
  entregado: number;
}

interface RecentOrder {
  id: string;
  created_at: string;
  total: number;
  estado: string;
  profiles: {
    full_name: string | null;
  } | null;
}

export default function AdminIndex() {
  const [counts, setCounts] = useState<OrderCounts>({ pendiente: 0, confirmado: 0, en_camino: 0, entregado: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch order counts by status
      const { data: ordersData } = await supabase
        .from('ordenes')
        .select('id, estado');

      const newCounts: OrderCounts = { pendiente: 0, confirmado: 0, en_camino: 0, entregado: 0 };
      ordersData?.forEach(order => {
        if (order.estado in newCounts) {
          newCounts[order.estado as keyof OrderCounts]++;
        }
      });
      setCounts(newCounts);

      // Fetch recent pending orders
      const { data: recentData } = await supabase
        .from('ordenes')
        .select('id, created_at, total, estado, user_id')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentData && recentData.length > 0) {
        const userIds = [...new Set(recentData.map(o => o.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const ordersWithProfiles = recentData.map(order => ({
          ...order,
          profiles: profilesMap.get(order.user_id) || null
        }));
        
        setRecentOrders(ordersWithProfiles);
      } else {
        setRecentOrders([]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('admin-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const StatusCard = ({ 
    title, 
    count, 
    icon: Icon, 
    color, 
    bgColor 
  }: { 
    title: string; 
    count: number; 
    icon: React.ElementType; 
    color: string; 
    bgColor: string;
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{count}</p>
          </div>
          <div className={`p-3 rounded-full ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard 
            title="Pendientes" 
            count={counts.pendiente} 
            icon={Clock}
            color="text-amber-600"
            bgColor="bg-amber-100"
          />
          <StatusCard 
            title="Confirmados" 
            count={counts.confirmado} 
            icon={CheckCircle}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatusCard 
            title="En Camino" 
            count={counts.en_camino} 
            icon={Truck}
            color="text-purple-600"
            bgColor="bg-purple-100"
          />
          <StatusCard 
            title="Entregados" 
            count={counts.entregado} 
            icon={Package}
            color="text-green-600"
            bgColor="bg-green-100"
          />
        </div>

        {/* Pending orders alert */}
        {counts.pendiente > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-800 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                ¡Hay {counts.pendiente} pedido{counts.pendiente > 1 ? 's' : ''} esperando confirmación!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">{order.profiles?.full_name || 'Sin nombre'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "HH:mm 'hrs'", { locale: es })} - S/ {order.total.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      Pendiente
                    </Badge>
                  </div>
                ))}
              </div>
              <Button asChild className="w-full mt-4">
                <Link to="/admin/ordenes">
                  Gestionar Pedidos <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link to="/admin/ordenes">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Ver Todos los Pedidos
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link to="/admin/productos">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Gestionar Productos
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link to="/admin/categorias">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Gestionar Categorías
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
            </Link>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}