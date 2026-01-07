import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Package,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, parseISO, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

interface DailyRevenue {
  fecha: string;
  total: number;
  ordenes: number;
}

interface TopProduct {
  nombre: string;
  cantidad: number;
  ingresos: number;
}

interface PaymentMethodData {
  name: string;
  value: number;
  color: string;
}

interface Stats {
  totalVentas: number;
  totalOrdenes: number;
  ticketPromedio: number;
  tasaCancelacion: number;
}

const PAYMENT_COLORS: Record<string, string> = {
  'efectivo': '#10b981',
  'yape_plin': '#8b5cf6',
  'tarjeta': '#3b82f6',
};

const PAYMENT_LABELS: Record<string, string> = {
  'efectivo': 'Efectivo',
  'yape_plin': 'Yape/Plin',
  'tarjeta': 'Tarjeta',
};

export default function Estadisticas() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '15' | '30'>('7');
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalVentas: 0,
    totalOrdenes: 0,
    ticketPromedio: 0,
    tasaCancelacion: 0
  });

  const fetchStats = async () => {
    setLoading(true);
    const days = parseInt(period);
    const startDate = startOfDay(subDays(new Date(), days - 1));
    const endDate = endOfDay(new Date());

    try {
      // Fetch all orders in the period
      const { data: ordenes, error: ordenesError } = await supabase
        .from('ordenes')
        .select('id, created_at, total, estado, metodo_pago')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (ordenesError) throw ordenesError;

      // Calculate stats
      const completedOrders = ordenes?.filter(o => o.estado === 'entregado') || [];
      const cancelledOrders = ordenes?.filter(o => o.estado === 'cancelado') || [];
      const allOrders = ordenes || [];

      const totalVentas = completedOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrdenes = completedOrders.length;
      const ticketPromedio = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0;
      const tasaCancelacion = allOrders.length > 0 
        ? (cancelledOrders.length / allOrders.length) * 100 
        : 0;

      setStats({
        totalVentas,
        totalOrdenes,
        ticketPromedio,
        tasaCancelacion
      });

      // Daily revenue data
      const revenueByDay: Record<string, { total: number; ordenes: number }> = {};
      
      // Initialize all days
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
        revenueByDay[date] = { total: 0, ordenes: 0 };
      }

      // Fill in actual data
      completedOrders.forEach(order => {
        const date = format(parseISO(order.created_at), 'yyyy-MM-dd');
        if (revenueByDay[date]) {
          revenueByDay[date].total += Number(order.total);
          revenueByDay[date].ordenes += 1;
        }
      });

      const dailyData = Object.entries(revenueByDay).map(([fecha, data]) => ({
        fecha: format(parseISO(fecha), 'dd/MM', { locale: es }),
        total: data.total,
        ordenes: data.ordenes
      }));

      setDailyRevenue(dailyData);

      // Payment methods distribution
      const paymentCounts: Record<string, number> = {};
      completedOrders.forEach(order => {
        const method = order.metodo_pago || 'efectivo';
        paymentCounts[method] = (paymentCounts[method] || 0) + Number(order.total);
      });

      const paymentData = Object.entries(paymentCounts).map(([method, value]) => ({
        name: PAYMENT_LABELS[method] || method,
        value,
        color: PAYMENT_COLORS[method] || '#6b7280'
      }));

      setPaymentMethods(paymentData);

      // Top products
      const completedOrderIds = completedOrders.map(o => o.id);
      
      if (completedOrderIds.length > 0) {
        const { data: orderItems, error: itemsError } = await supabase
          .from('orden_items')
          .select('producto_id, cantidad, precio_unitario')
          .in('orden_id', completedOrderIds);

        if (itemsError) throw itemsError;

        // Get unique product IDs
        const productIds = [...new Set(orderItems?.map(i => i.producto_id).filter(Boolean))] as string[];
        
        if (productIds.length > 0) {
          const { data: productos } = await supabase
            .from('productos')
            .select('id, nombre')
            .in('id', productIds);

          const productNames = new Map(productos?.map(p => [p.id, p.nombre]) || []);

          // Aggregate by product
          const productStats: Record<string, { cantidad: number; ingresos: number; nombre: string }> = {};
          
          orderItems?.forEach(item => {
            if (item.producto_id) {
              if (!productStats[item.producto_id]) {
                productStats[item.producto_id] = {
                  cantidad: 0,
                  ingresos: 0,
                  nombre: productNames.get(item.producto_id) || 'Producto eliminado'
                };
              }
              productStats[item.producto_id].cantidad += item.cantidad;
              productStats[item.producto_id].ingresos += item.cantidad * Number(item.precio_unitario);
            }
          });

          const topProductsData = Object.values(productStats)
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10)
            .map(p => ({
              nombre: p.nombre.length > 20 ? p.nombre.substring(0, 20) + '...' : p.nombre,
              cantidad: p.cantidad,
              ingresos: p.ingresos
            }));

          setTopProducts(topProductsData);
        } else {
          setTopProducts([]);
        }
      } else {
        setTopProducts([]);
      }

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  const StatCard = ({ 
    title, 
    value, 
    subtitle,
    icon: Icon, 
    color
  }: { 
    title: string; 
    value: string; 
    subtitle?: string;
    icon: React.ElementType; 
    color: string;
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard de Ventas</h1>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              <Button 
                variant={period === '7' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setPeriod('7')}
              >
                7 días
              </Button>
              <Button 
                variant={period === '15' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setPeriod('15')}
              >
                15 días
              </Button>
              <Button 
                variant={period === '30' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setPeriod('30')}
              >
                30 días
              </Button>
            </div>
            <Button variant="outline" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Ventas Totales" 
            value={`S/ ${stats.totalVentas.toFixed(2)}`}
            subtitle={`Últimos ${period} días`}
            icon={DollarSign}
            color="bg-green-500"
          />
          <StatCard 
            title="Órdenes Completadas" 
            value={stats.totalOrdenes.toString()}
            subtitle="Entregadas"
            icon={ShoppingCart}
            color="bg-blue-500"
          />
          <StatCard 
            title="Ticket Promedio" 
            value={`S/ ${stats.ticketPromedio.toFixed(2)}`}
            subtitle="Por orden"
            icon={TrendingUp}
            color="bg-purple-500"
          />
          <StatCard 
            title="Tasa Cancelación" 
            value={`${stats.tasaCancelacion.toFixed(1)}%`}
            subtitle="Del total"
            icon={Package}
            color={stats.tasaCancelacion > 10 ? "bg-red-500" : "bg-gray-500"}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Ingresos Diarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="fecha" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `S/${value}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`S/ ${value.toFixed(2)}`, 'Ingresos']}
                      labelFormatter={(label) => `Fecha: ${label}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Productos Más Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        dataKey="nombre" 
                        type="category" 
                        width={100}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'cantidad' ? `${value} unidades` : `S/ ${value.toFixed(2)}`,
                          name === 'cantidad' ? 'Cantidad' : 'Ingresos'
                        ]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="cantidad" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No hay datos de productos
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Métodos de Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {paymentMethods.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethods}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`S/ ${value.toFixed(2)}`, 'Total']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No hay datos de pagos
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex justify-center gap-4 mt-4">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: method.color }}
                    />
                    <span className="text-sm text-muted-foreground">{method.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
