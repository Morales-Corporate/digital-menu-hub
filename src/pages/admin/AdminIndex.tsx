import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
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
  RefreshCw,
  AlertTriangle,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  UtensilsCrossed,
  ChefHat
} from 'lucide-react';
import { format, differenceInMinutes, parseISO, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderCounts {
  pendiente: number;
  confirmado: number;
  en_preparacion: number;
  listo: number;
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

interface DailySummary {
  todaySales: number;
  todayOrders: number;
  yesterdaySales: number;
  yesterdayOrders: number;
}

export default function AdminIndex() {
  const { isEstadoVisible } = useBusinessConfig();
  const [counts, setCounts] = useState<OrderCounts>({ pendiente: 0, confirmado: 0, en_preparacion: 0, listo: 0, en_camino: 0, entregado: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    todaySales: 0,
    todayOrders: 0,
    yesterdaySales: 0,
    yesterdayOrders: 0
  });

  // Update current time every minute to refresh wait time and clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getWaitTimeDisplay = (createdAt: string) => {
    const waitMinutes = differenceInMinutes(new Date(), parseISO(createdAt));
    
    if (waitMinutes >= 25) {
      return (
        <Badge variant="destructive" className="animate-pulse text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {waitMinutes} min
        </Badge>
      );
    } else if (waitMinutes >= 15) {
      return (
        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {waitMinutes} min
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {waitMinutes} min
        </Badge>
      );
    }
  };

  // Helper to get date key in Lima timezone
  const getDateKeyLima = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const todayKey = getDateKeyLima(new Date());
      const today = startOfDay(new Date());
      const yesterday = startOfDay(subDays(new Date(), 1));

      // Fetch closed dates to filter orders not yet closed
      const { data: cierresData } = await supabase
        .from('cierres_caja')
        .select('fecha');
      
      const fechasCerradas = cierresData?.map(c => c.fecha) || [];

      // Fetch all orders
      const { data: ordersData } = await supabase
        .from('ordenes')
        .select('id, estado, created_at');

      // Filter orders: only today's orders that are NOT in a closed date
      const visibleOrders = ordersData?.filter(order => {
        const orderDateKey = getDateKeyLima(order.created_at);
        if (orderDateKey !== todayKey) return false;
        if (fechasCerradas.includes(orderDateKey)) return false;
        return true;
      }) || [];

      const newCounts: OrderCounts = { pendiente: 0, confirmado: 0, en_preparacion: 0, listo: 0, en_camino: 0, entregado: 0 };
      visibleOrders.forEach(order => {
        if (order.estado in newCounts) {
          newCounts[order.estado as keyof OrderCounts]++;
        }
      });
      setCounts(newCounts);

      // Fetch today's sales (only from visible orders that are entregado)
      const entregadosHoy = visibleOrders.filter(o => o.estado === 'entregado');
      const { data: todayData } = entregadosHoy.length > 0 
        ? await supabase
            .from('ordenes')
            .select('total')
            .in('id', entregadosHoy.map(o => o.id))
        : { data: [] };

      // Fetch yesterday's sales (for comparison)
      const { data: yesterdayData } = await supabase
        .from('ordenes')
        .select('total')
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())
        .eq('estado', 'entregado');

      let todaySalesTotal = 0;
      todayData?.forEach(o => { todaySalesTotal += o.total || 0; });
      let yesterdaySalesTotal = 0;
      yesterdayData?.forEach(o => { yesterdaySalesTotal += o.total || 0; });

      setDailySummary({
        todaySales: todaySalesTotal,
        todayOrders: entregadosHoy.length,
        yesterdaySales: yesterdaySalesTotal,
        yesterdayOrders: yesterdayData?.length || 0
      });

      // Fetch recent pending orders (only visible ones)
      const pendingOrders = visibleOrders
        .filter(o => o.estado === 'pendiente')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      if (pendingOrders.length > 0) {
        const { data: fullPendingData } = await supabase
          .from('ordenes')
          .select('id, created_at, total, estado, user_id')
          .in('id', pendingOrders.map(o => o.id));

        const userIds = [...new Set(fullPendingData?.filter(o => o.user_id).map(o => o.user_id) || [])];
        const { data: profilesData } = userIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', userIds)
          : { data: [] };
        
        const profilesMap = new Map((profilesData || []).map(p => [p.id, p] as const));
        
        const ordersWithProfiles: RecentOrder[] = (fullPendingData || []).map(order => ({
          ...order,
          profiles: order.user_id ? profilesMap.get(order.user_id) || null : null
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

  const salesDiff = dailySummary.todaySales - dailySummary.yesterdaySales;
  const salesTrend = dailySummary.yesterdaySales > 0 
    ? ((salesDiff / dailySummary.yesterdaySales) * 100).toFixed(0)
    : dailySummary.todaySales > 0 ? '100' : '0';

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header con fecha y hora */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <Calendar className="h-4 w-4" />
              <span className="capitalize">
                {format(currentTime, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </span>
              <span className="text-foreground font-medium">
                {format(currentTime, "HH:mm")} hrs
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Resumen de ventas del día */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Ventas de Hoy</p>
                <p className="text-2xl font-bold flex items-center gap-1">
                  <DollarSign className="h-5 w-5 text-primary" />
                  S/ {dailySummary.todaySales.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Órdenes Hoy</p>
                <p className="text-2xl font-bold">{dailySummary.todayOrders}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventas Ayer</p>
                <p className="text-xl text-muted-foreground">S/ {dailySummary.yesterdaySales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tendencia</p>
                <div className={`flex items-center gap-1 text-lg font-semibold ${salesDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {salesDiff >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {salesDiff >= 0 ? '+' : ''}{salesTrend}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {isEstadoVisible('pendiente') && (
            <StatusCard 
              title="Pendientes" 
              count={counts.pendiente} 
              icon={Clock}
              color="text-amber-600"
              bgColor="bg-amber-100"
            />
          )}
          {isEstadoVisible('confirmado') && (
            <StatusCard 
              title="Confirmados" 
              count={counts.confirmado} 
              icon={CheckCircle}
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
          )}
          {isEstadoVisible('en_preparacion') && (
            <StatusCard 
              title="En Preparación" 
              count={counts.en_preparacion} 
              icon={UtensilsCrossed}
              color="text-orange-600"
              bgColor="bg-orange-100"
            />
          )}
          {isEstadoVisible('listo') && (
            <StatusCard 
              title="Listos" 
              count={counts.listo} 
              icon={ChefHat}
              color="text-teal-600"
              bgColor="bg-teal-100"
            />
          )}
          {isEstadoVisible('en_camino') && (
            <StatusCard 
              title="En Camino" 
              count={counts.en_camino} 
              icon={Truck}
              color="text-purple-600"
              bgColor="bg-purple-100"
            />
          )}
          {isEstadoVisible('entregado') && (
            <StatusCard 
              title="Entregados" 
              count={counts.entregado} 
              icon={Package}
              color="text-green-600"
              bgColor="bg-green-100"
            />
          )}
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{order.profiles?.full_name || 'Sin nombre'}</p>
                        {getWaitTimeDisplay(order.created_at)}
                      </div>
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