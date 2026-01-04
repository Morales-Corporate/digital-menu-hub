import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift, Cake, ArrowLeft, Star, TrendingUp, Clock, CheckCircle, Package } from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

const ESTADOS_PENDIENTES = ['pendiente', 'confirmado', 'en_preparacion', 'en_camino'];
const ESTADO_ENTREGADO = 'entregado';

const getEstadoConfig = (estado: string) => {
  switch (estado) {
    case 'pendiente':
      return { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock };
    case 'confirmado':
      return { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle };
    case 'en_preparacion':
      return { label: 'En Preparación', color: 'bg-orange-500', icon: Package };
    case 'en_camino':
      return { label: 'En Camino', color: 'bg-purple-500', icon: Package };
    case 'entregado':
      return { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle };
    default:
      return { label: estado, color: 'bg-muted', icon: Clock };
  }
};

export default function MiCuenta() {
  const { user } = useAuth();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: puntos, isLoading: loadingPuntos } = useQuery({
    queryKey: ['my-points', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('puntos_usuario')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Obtener todas las órdenes del usuario
  const { data: ordenes, isLoading: loadingOrdenes } = useQuery({
    queryKey: ['my-orders-cuenta', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          *,
          orden_items (
            *,
            producto:productos (nombre, imagen_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isLoading = loadingProfile || loadingPuntos || loadingOrdenes;

  // Separar órdenes pendientes y entregadas
  const ordenesPendientes = ordenes?.filter((o: any) => 
    ESTADOS_PENDIENTES.includes(o.estado)
  ) || [];
  
  const ordenesEntregadas = ordenes?.filter((o: any) => 
    o.estado === ESTADO_ENTREGADO
  ) || [];

  const ultimaOrdenEntregada = ordenesEntregadas[0];

  const isBirthday = () => {
    if (!profile?.fecha_nacimiento) return false;
    const today = new Date();
    const birthday = new Date(profile.fecha_nacimiento);
    return today.getDate() === birthday.getDate() && today.getMonth() === birthday.getMonth();
  };

  const getPointsLevel = (points: number) => {
    if (points >= 1000) return { name: 'Oro', color: 'text-yellow-500', next: null };
    if (points >= 500) return { name: 'Plata', color: 'text-gray-400', next: 1000 };
    if (points >= 100) return { name: 'Bronce', color: 'text-orange-600', next: 500 };
    return { name: 'Nuevo', color: 'text-muted-foreground', next: 100 };
  };

  const pointsData = puntos?.puntos_totales ?? 0;
  const level = getPointsLevel(pointsData);

  const renderOrdenPendiente = (orden: any) => {
    const estadoConfig = getEstadoConfig(orden.estado);
    const IconComponent = estadoConfig.icon;

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Badge className={`${estadoConfig.color} text-white flex items-center gap-1`}>
            <IconComponent className="h-3 w-3" />
            {estadoConfig.label}
          </Badge>
          <span className="text-sm text-accent flex items-center gap-1">
            <Gift className="h-4 w-4" />
            +{orden.puntos_ganados} pts
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date(orden.created_at).toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
        <div className="space-y-2">
          {orden.orden_items?.slice(0, 3).map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
              {item.producto?.imagen_url ? (
                <img 
                  src={item.producto.imagen_url} 
                  alt={item.producto?.nombre || 'Producto'} 
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                  <Gift className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">{item.producto?.nombre || 'Producto'}</div>
                <div className="text-xs text-muted-foreground">x{item.cantidad}</div>
              </div>
              <div className="font-semibold text-sm">
                S/ {(item.precio_unitario * item.cantidad).toFixed(2)}
              </div>
            </div>
          ))}
          {orden.orden_items?.length > 3 && (
            <div className="text-sm text-muted-foreground text-center">
              +{orden.orden_items.length - 3} productos más
            </div>
          )}
        </div>
        <div className="flex justify-between pt-2 border-t font-semibold">
          <span>Total</span>
          <span className="text-primary">S/ {Number(orden.total).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const renderUltimaOrden = (orden: any) => {
    return (
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{new Date(orden.created_at).toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
          <span>+{orden.puntos_ganados} puntos</span>
        </div>
        <div className="space-y-2">
          {orden.orden_items?.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
              {item.producto?.imagen_url ? (
                <img 
                  src={item.producto.imagen_url} 
                  alt={item.producto?.nombre || 'Producto'} 
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                  <Gift className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">{item.producto?.nombre || 'Producto'}</div>
                <div className="text-xs text-muted-foreground">x{item.cantidad}</div>
              </div>
              <div className="font-semibold text-sm">
                S/ {(item.precio_unitario * item.cantidad).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-2 border-t font-semibold">
          <span>Total</span>
          <span className="text-primary">S/ {Number(orden.total).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <span className="font-display text-xl font-semibold">Mi Cuenta</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Birthday Banner */}
            {isBirthday() && (
              <Card className="bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
                <CardContent className="py-6 flex items-center gap-4">
                  <Cake className="h-12 w-12 text-primary" />
                  <div>
                    <h2 className="font-display text-2xl font-bold">¡Feliz Cumpleaños!</h2>
                    <p className="text-muted-foreground">Disfruta un 20% de descuento en tu próxima orden</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Points Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Mis Puntos
                </CardTitle>
                <CardDescription>Acumula puntos con cada compra</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-4xl font-display font-bold text-primary">
                      {pointsData.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">puntos acumulados</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${level.color}`}>
                      <Star className="inline h-5 w-5 mr-1" />
                      Nivel {level.name}
                    </div>
                    {level.next && (
                      <div className="text-xs text-muted-foreground">
                        {level.next - pointsData} puntos para el siguiente nivel
                      </div>
                    )}
                  </div>
                </div>
                {level.next && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ width: `${Math.min((pointsData / level.next) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Órdenes Pendientes (Carrusel) o Última Orden Entregada */}
            {ordenesPendientes.length > 0 ? (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Órdenes Pendientes
                  </CardTitle>
                  <CardDescription>Seguimiento de tus pedidos en curso</CardDescription>
                </CardHeader>
                <CardContent>
                  {ordenesPendientes.length === 1 ? (
                    renderOrdenPendiente(ordenesPendientes[0])
                  ) : (
                    <Carousel className="w-full">
                      <CarouselContent>
                        {ordenesPendientes.map((orden: any) => (
                          <CarouselItem key={orden.id}>
                            {renderOrdenPendiente(orden)}
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <div className="flex justify-center gap-2 mt-4">
                        <CarouselPrevious className="static translate-y-0" />
                        <CarouselNext className="static translate-y-0" />
                      </div>
                    </Carousel>
                  )}
                </CardContent>
              </Card>
            ) : ultimaOrdenEntregada ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Última Orden
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderUltimaOrden(ultimaOrdenEntregada)}
                </CardContent>
              </Card>
            ) : null}

            {/* Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle>Sugerencias para ti</CardTitle>
                <CardDescription>Basado en tus preferencias</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-4">
                  Realiza más pedidos para recibir sugerencias personalizadas
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
