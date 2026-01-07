import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Gift, Star, Lock, Unlock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export default function Recompensas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Obtener puntos del usuario
  const { data: puntosData, isLoading: loadingPuntos } = useQuery({
    queryKey: ['user-points', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('puntos_usuario')
        .select('puntos_totales')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Obtener todas las recompensas activas
  const { data: recompensas, isLoading: loadingRecompensas } = useQuery({
    queryKey: ['recompensas-activas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recompensas')
        .select('*')
        .eq('activo', true)
        .order('puntos_requeridos', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Obtener descuento activo del usuario (si tiene uno sin usar)
  const { data: descuentoActivo } = useQuery({
    queryKey: ['descuento-activo', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('descuentos_activos')
        .select('*, recompensas(*)')
        .eq('user_id', user.id)
        .eq('usado', false)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const puntos = puntosData?.puntos_totales || 0;

  // Mutation para activar una recompensa
  const activarRecompensa = useMutation({
    mutationFn: async (recompensa: any) => {
      if (!user) throw new Error('No autenticado');
      
      // Crear el descuento activo
      const { error: insertError } = await supabase
        .from('descuentos_activos')
        .insert({
          user_id: user.id,
          recompensa_id: recompensa.id,
          puntos_usados: recompensa.puntos_requeridos,
        });
      
      if (insertError) throw insertError;

      // Descontar los puntos
      const { error: updateError } = await supabase
        .from('puntos_usuario')
        .update({ 
          puntos_totales: puntos - recompensa.puntos_requeridos 
        })
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['descuento-activo'] });
      toast.success('¡Descuento activado! Podrás usarlo en tu próximo pedido.');
    },
    onError: (error: any) => {
      toast.error('Error al activar el descuento: ' + error.message);
    },
  });

  const handleActivar = (recompensa: any) => {
    if (descuentoActivo) {
      toast.error('Ya tienes un descuento activo. Úsalo antes de activar otro.');
      return;
    }
    if (puntos < recompensa.puntos_requeridos) {
      toast.error('No tienes suficientes puntos para esta recompensa.');
      return;
    }
    activarRecompensa.mutate(recompensa);
  };

  const isLoading = loadingPuntos || loadingRecompensas;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Gift className="h-6 w-6 text-primary" />
            Mis Recompensas
          </h1>
          <p className="text-muted-foreground">
            Canjea tus puntos por descuentos exclusivos
          </p>
        </div>

        {/* Tarjeta de puntos actuales */}
        <Card className="mb-6 bg-gradient-to-br from-primary/10 to-secondary/20 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tus puntos actuales</p>
                <p className="text-4xl font-bold text-primary flex items-center gap-2">
                  <Star className="h-8 w-8 fill-yellow-500 text-yellow-500" />
                  {puntos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Descuento activo */}
        {descuentoActivo && (
          <Card className="mb-6 border-green-300 bg-green-50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Tienes un descuento activo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">{descuentoActivo.recompensas?.nombre}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {descuentoActivo.recompensas?.porcentaje_descuento}% OFF
                  </p>
                </div>
                <Badge className="bg-green-500 text-white">Listo para usar</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Este descuento se aplicará automáticamente en tu próximo pedido.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Lista de recompensas */}
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Recompensas disponibles</h2>
          {recompensas?.map((recompensa) => {
            const canActivate = puntos >= recompensa.puntos_requeridos;
            const progress = Math.min((puntos / recompensa.puntos_requeridos) * 100, 100);
            const puntosRestantes = recompensa.puntos_requeridos - puntos;

            return (
              <Card 
                key={recompensa.id} 
                className={`transition-all ${canActivate ? 'border-primary/50 shadow-md' : 'opacity-75'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {canActivate ? (
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Unlock className="h-5 w-5 text-primary" />
                        </div>
                      ) : (
                        <div className="bg-muted p-2 rounded-full">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{recompensa.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {recompensa.puntos_requeridos} puntos
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={canActivate ? "default" : "secondary"}
                      className="text-lg px-3 py-1"
                    >
                      {recompensa.porcentaje_descuento}% OFF
                    </Badge>
                  </div>

                  {!canActivate && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{puntos} pts</span>
                        <span>{recompensa.puntos_requeridos} pts</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Te faltan {puntosRestantes} puntos
                      </p>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    disabled={!canActivate || !!descuentoActivo || activarRecompensa.isPending}
                    onClick={() => handleActivar(recompensa)}
                  >
                    {activarRecompensa.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Activando...
                      </>
                    ) : canActivate ? (
                      descuentoActivo ? 'Ya tienes un descuento activo' : 'Activar descuento'
                    ) : (
                      `Necesitas ${puntosRestantes} puntos más`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {(!recompensas || recompensas.length === 0) && (
            <Card>
              <CardContent className="p-6 text-center">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No hay recompensas disponibles en este momento.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Información */}
        <Card className="mt-6 bg-muted/50">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">¿Cómo funcionan los puntos?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Ganas 1 punto por cada S/ 1.00 en pedidos entregados</li>
              <li>• Los puntos se acumulan cuando tu pedido es entregado</li>
              <li>• Solo puedes tener un descuento activo a la vez</li>
              <li>• El descuento se aplica automáticamente en el checkout</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
