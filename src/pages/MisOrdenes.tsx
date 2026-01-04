import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, ShoppingBag, Gift, Clock, CheckCircle, Package } from 'lucide-react';
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

export default function MisOrdenes() {
  const { user } = useAuth();

  const { data: ordenes, isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
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

  // Separar órdenes pendientes y entregadas
  const ordenesPendientes = ordenes?.filter((o: any) => 
    ESTADOS_PENDIENTES.includes(o.estado)
  ) || [];
  
  const ordenesEntregadas = ordenes?.filter((o: any) => 
    o.estado === ESTADO_ENTREGADO
  ) || [];

  const ultimaOrdenEntregada = ordenesEntregadas[0];

  const renderOrdenCard = (orden: any, isPendiente: boolean = false) => {
    const estadoConfig = getEstadoConfig(orden.estado);
    const IconComponent = estadoConfig.icon;

    return (
      <Card className={`overflow-hidden ${isPendiente ? 'border-primary/50 shadow-lg' : ''}`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Badge className={`${estadoConfig.color} text-white flex items-center gap-1`}>
                <IconComponent className="h-3 w-3" />
                {estadoConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-accent">
              <Gift className="h-4 w-4" />
              +{orden.puntos_ganados} pts
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-3">
            {new Date(orden.created_at).toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          
          <div className="space-y-2 mb-3">
            {orden.orden_items?.slice(0, 3).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3">
                {item.producto?.imagen_url ? (
                  <img 
                    src={item.producto.imagen_url} 
                    alt={item.producto?.nombre || 'Producto'} 
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded" />
                )}
                <div className="flex-1 text-sm">
                  <span className="font-medium">{item.producto?.nombre || 'Producto'}</span>
                  <span className="text-muted-foreground"> x{item.cantidad}</span>
                </div>
                <span className="text-sm">S/ {(item.precio_unitario * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
            {orden.orden_items?.length > 3 && (
              <div className="text-sm text-muted-foreground">
                +{orden.orden_items.length - 3} productos más
              </div>
            )}
          </div>
          
          <div className="flex justify-between pt-3 border-t font-semibold">
            <span>Total</span>
            <span className="text-primary">S/ {Number(orden.total).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
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
            <span className="font-display text-xl font-semibold">Mis Órdenes</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container py-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : ordenes?.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-display text-2xl mb-2">Sin órdenes aún</h2>
            <p className="text-muted-foreground mb-4">
              Realiza tu primera compra para verla aquí
            </p>
            <Button asChild>
              <Link to="/">Ver Menú</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Carrusel de órdenes pendientes */}
            {ordenesPendientes.length > 0 ? (
              <section>
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Órdenes Pendientes
                </h2>
                {ordenesPendientes.length === 1 ? (
                  renderOrdenCard(ordenesPendientes[0], true)
                ) : (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {ordenesPendientes.map((orden: any) => (
                        <CarouselItem key={orden.id} className="md:basis-1/2 lg:basis-1/2">
                          {renderOrdenCard(orden, true)}
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="-left-4" />
                    <CarouselNext className="-right-4" />
                  </Carousel>
                )}
              </section>
            ) : ultimaOrdenEntregada ? (
              /* Última orden entregada (solo si no hay pendientes) */
              <section>
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Última Orden
                </h2>
                {renderOrdenCard(ultimaOrdenEntregada)}
              </section>
            ) : null}

            {/* Historial de órdenes */}
            {ordenesEntregadas.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-semibold mb-4">
                  Historial de Órdenes
                </h2>
                <div className="space-y-4">
                  {ordenesEntregadas.map((orden: any) => (
                    <div key={orden.id}>
                      {renderOrdenCard(orden)}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
