import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, ShoppingBag, Gift } from 'lucide-react';
import UserMenu from '@/components/UserMenu';

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
          <div className="space-y-4">
            {ordenes?.map((orden: any) => (
              <Card key={orden.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(orden.created_at).toLocaleDateString('es-ES', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-accent">
                      <Gift className="h-4 w-4" />
                      +{orden.puntos_ganados} pts
                    </div>
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
                        <span className="text-sm">${(item.precio_unitario * item.cantidad).toFixed(2)}</span>
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
                    <span className="text-primary">${Number(orden.total).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
