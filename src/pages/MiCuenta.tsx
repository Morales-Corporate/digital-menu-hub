import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Gift, Cake, ArrowLeft, Star, TrendingUp } from 'lucide-react';
import UserMenu from '@/components/UserMenu';

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

  const { data: ultimaOrden, isLoading: loadingOrden } = useQuery({
    queryKey: ['my-last-order', user?.id],
    queryFn: async () => {
      if (!user) return null;
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isLoading = loadingProfile || loadingPuntos || loadingOrden;

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

            {/* Last Order */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Última Orden
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ultimaOrden ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{new Date(ultimaOrden.created_at).toLocaleDateString('es-ES', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                      <span>+{ultimaOrden.puntos_ganados} puntos</span>
                    </div>
                    <div className="space-y-2">
                      {ultimaOrden.orden_items?.map((item: any) => (
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
                            ${(item.precio_unitario * item.cantidad).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Total</span>
                      <span className="text-primary">${Number(ultimaOrden.total).toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Aún no tienes órdenes. ¡Haz tu primera compra!
                  </p>
                )}
              </CardContent>
            </Card>

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
