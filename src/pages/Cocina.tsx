import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogOut, ChefHat, Clock, Flame, CheckCircle2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type OrdenConItems = {
  id: string;
  numero_mesa: number | null;
  estado: string;
  created_at: string | null;
  nombre_invitado: string | null;
  orden_items: {
    id: string;
    cantidad: number;
    producto_id: string | null;
    productos: { nombre: string } | null;
  }[];
};

const ESTADOS_COCINA = ['pendiente', 'confirmado', 'en_preparacion', 'listo'] as const;

const estadoConfig = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  confirmado: { label: 'Confirmado', icon: Clock, color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  en_preparacion: { label: 'En preparación', icon: Flame, color: 'bg-orange-500/10 text-orange-700 border-orange-200' },
  listo: { label: 'Listo', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
};

export default function Cocina() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current open caja session
  const { data: cajaAbierta } = useQuery({
    queryKey: ['caja-abierta-cocina'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aperturas_caja')
        .select('id, fecha_apertura')
        .eq('estado', 'abierta')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ['ordenes-cocina', cajaAbierta?.fecha_apertura],
    queryFn: async () => {
      let query = supabase
        .from('ordenes')
        .select(`
          id, numero_mesa, estado, created_at, nombre_invitado,
          orden_items(id, cantidad, producto_id, productos(nombre))
        `)
        .in('estado', ['pendiente', 'confirmado', 'en_preparacion', 'listo'])
        .order('created_at', { ascending: true });

      if (cajaAbierta?.fecha_apertura) {
        query = query.gte('created_at', cajaAbierta.fecha_apertura);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as OrdenConItems[]) ?? [];
    },
    refetchInterval: 5000,
    enabled: !!cajaAbierta,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('cocina-ordenes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ordenes-cocina'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const updateEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await supabase.from('ordenes').update({ estado }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-cocina'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar estado'),
  });

  const getNextEstado = (estado: string) => {
    if (estado === 'pendiente') return 'confirmado';
    if (estado === 'confirmado') return 'en_preparacion';
    if (estado === 'en_preparacion') return 'listo';
    return null;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const ordenesPorEstado = (estado: string) => ordenes.filter(o => o.estado === estado);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Cocina</h1>
          <Badge variant="secondary" className="ml-2">
            {ordenes.filter(o => o.estado !== 'listo').length} activos
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['ordenes-cocina'] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {ESTADOS_COCINA.map(estado => {
            const config = estadoConfig[estado];
            const Icon = config.icon;
            const items = ordenesPorEstado(estado);

            return (
              <div key={estado} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Icon className="h-5 w-5" />
                  <h2 className="font-semibold text-lg">{config.label}</h2>
                  <Badge variant="outline">{items.length}</Badge>
                </div>

                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin pedidos</p>
                )}

                {items.map(orden => {
                  const next = getNextEstado(orden.estado);
                  return (
                    <Card key={orden.id} className={`border ${config.color} transition-all`}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {orden.numero_mesa ? `Mesa ${orden.numero_mesa}` : orden.nombre_invitado || 'Para llevar'}
                          </CardTitle>
                          {orden.created_at && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(orden.created_at), { addSuffix: true, locale: es })}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        <ul className="space-y-1">
                          {orden.orden_items.map(item => (
                            <li key={item.id} className="flex items-center gap-2 text-sm">
                              <span className="font-medium min-w-[1.5rem] text-center">{item.cantidad}×</span>
                              <span>{item.productos?.nombre ?? 'Producto eliminado'}</span>
                            </li>
                          ))}
                        </ul>
                        {next && (
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            variant={estado === 'pendiente' ? 'default' : 'outline'}
                            onClick={() => updateEstado.mutate({ id: orden.id, estado: next })}
                            disabled={updateEstado.isPending}
                          >
                            {next === 'en_preparacion' ? 'Iniciar preparación' : 'Marcar como listo'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
