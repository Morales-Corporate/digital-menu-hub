import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Users, Clock, DollarSign, ClipboardList, TrendingUp, Pencil } from 'lucide-react';
import { format, subDays, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

interface Mesero {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  created_at: string;
}

interface AsignacionMesa {
  id: string;
  mesero_id: string;
  mesa_inicio: number;
  mesa_fin: number;
  fecha: string;
  turno: string;
}

interface MeseroStats {
  mesero_id: string;
  nombre: string;
  total_ventas: number;
  ordenes_atendidas: number;
  tiempo_promedio_min: number;
}

export default function Meseros() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [asignacionDialogOpen, setAsignacionDialogOpen] = useState(false);
  const [editingMesero, setEditingMesero] = useState<Mesero | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [periodoStats, setPeriodoStats] = useState('0');

  // Asignación state
  const [selectedMesero, setSelectedMesero] = useState('');
  const [mesaInicio, setMesaInicio] = useState('1');
  const [mesaFin, setMesaFin] = useState('5');
  const [turno, setTurno] = useState('dia');

  const { data: meseros = [], isLoading } = useQuery({
    queryKey: ['meseros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meseros')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data as Mesero[];
    }
  });

  const { data: asignacionesHoy = [] } = useQuery({
    queryKey: ['asignaciones-hoy'],
    queryFn: async () => {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('asignacion_mesas')
        .select('*, meseros(nombre)')
        .eq('fecha', hoy);
      if (error) throw error;
      return data;
    }
  });

  const { data: estadisticas = [] } = useQuery({
    queryKey: ['estadisticas-meseros', periodoStats],
    queryFn: async () => {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      const fechaInicio = periodoStats === '0' 
        ? hoy 
        : format(subDays(new Date(), parseInt(periodoStats)), 'yyyy-MM-dd');
      
      let query = supabase
        .from('ordenes')
        .select('id, mesero_id, total, created_at, entregado_at, estado')
        .eq('estado', 'entregado')
        .not('mesero_id', 'is', null);
      
      if (periodoStats === '0') {
        // Filtrar solo órdenes de hoy
        query = query.gte('created_at', `${hoy}T00:00:00`).lt('created_at', `${hoy}T23:59:59.999`);
      } else {
        query = query.gte('created_at', fechaInicio);
      }
      
      const { data: ordenes, error } = await query;
      
      if (error) throw error;

      // Agrupar por mesero
      const statsMap = new Map<string, { total: number; count: number; tiempos: number[] }>();
      
      ordenes?.forEach(orden => {
        if (!orden.mesero_id) return;
        
        const existing = statsMap.get(orden.mesero_id) || { total: 0, count: 0, tiempos: [] };
        existing.total += Number(orden.total);
        existing.count += 1;
        
        if (orden.entregado_at && orden.created_at) {
          const mins = differenceInMinutes(new Date(orden.entregado_at), new Date(orden.created_at));
          if (mins > 0 && mins < 180) { // Filtrar tiempos razonables
            existing.tiempos.push(mins);
          }
        }
        
        statsMap.set(orden.mesero_id, existing);
      });

      // Combinar con nombres de meseros
      const stats: MeseroStats[] = [];
      meseros.forEach(mesero => {
        const data = statsMap.get(mesero.id);
        stats.push({
          mesero_id: mesero.id,
          nombre: mesero.nombre,
          total_ventas: data?.total || 0,
          ordenes_atendidas: data?.count || 0,
          tiempo_promedio_min: data?.tiempos.length 
            ? Math.round(data.tiempos.reduce((a, b) => a + b, 0) / data.tiempos.length)
            : 0
        });
      });

      return stats.sort((a, b) => b.total_ventas - a.total_ventas);
    },
    enabled: meseros.length > 0
  });

  const createMesero = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('meseros')
        .insert({ nombre, telefono: telefono || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meseros'] });
      toast.success('Mesero agregado');
      resetForm();
    },
    onError: () => toast.error('Error al agregar mesero')
  });

  const updateMesero = useMutation({
    mutationFn: async () => {
      if (!editingMesero) return;
      const { error } = await supabase
        .from('meseros')
        .update({ nombre, telefono: telefono || null })
        .eq('id', editingMesero.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meseros'] });
      toast.success('Mesero actualizado');
      resetForm();
    },
    onError: () => toast.error('Error al actualizar')
  });

  const toggleActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from('meseros')
        .update({ activo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meseros'] });
    }
  });

  const createAsignacion = useMutation({
    mutationFn: async () => {
      const hoy = format(new Date(), 'yyyy-MM-dd');
      const { error } = await supabase
        .from('asignacion_mesas')
        .upsert({
          mesero_id: selectedMesero,
          mesa_inicio: parseInt(mesaInicio),
          mesa_fin: parseInt(mesaFin),
          fecha: hoy,
          turno
        }, { onConflict: 'fecha,turno,mesero_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones-hoy'] });
      toast.success('Asignación guardada');
      setAsignacionDialogOpen(false);
    },
    onError: () => toast.error('Error al asignar')
  });

  const resetForm = () => {
    setNombre('');
    setTelefono('');
    setEditingMesero(null);
    setDialogOpen(false);
  };

  const handleEdit = (mesero: Mesero) => {
    setEditingMesero(mesero);
    setNombre(mesero.nombre);
    setTelefono(mesero.telefono || '');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (editingMesero) {
      updateMesero.mutate();
    } else {
      createMesero.mutate();
    }
  };

  const meserosActivos = meseros.filter(m => m.activo);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Meseros</h1>
            <p className="text-muted-foreground mt-1">Gestiona tu equipo y asignaciones de mesas</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={asignacionDialogOpen} onOpenChange={setAsignacionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Asignar Mesas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Asignar Mesas para Hoy</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Mesero</Label>
                    <Select value={selectedMesero} onValueChange={setSelectedMesero}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar mesero" />
                      </SelectTrigger>
                      <SelectContent>
                        {meserosActivos.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mesa Inicio</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={mesaInicio} 
                        onChange={e => setMesaInicio(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mesa Fin</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={mesaFin} 
                        onChange={e => setMesaFin(e.target.value)} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Turno</Label>
                    <Select value={turno} onValueChange={setTurno}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dia">Día</SelectItem>
                        <SelectItem value="noche">Noche</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => createAsignacion.mutate()} className="w-full">
                    Guardar Asignación
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Mesero
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingMesero ? 'Editar Mesero' : 'Nuevo Mesero'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input 
                      id="nombre" 
                      value={nombre} 
                      onChange={e => setNombre(e.target.value)} 
                      placeholder="Nombre del mesero"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input 
                      id="telefono" 
                      value={telefono} 
                      onChange={e => setTelefono(e.target.value)} 
                      placeholder="Número de teléfono"
                    />
                  </div>
                  <Button onClick={handleSubmit} className="w-full">
                    {editingMesero ? 'Guardar Cambios' : 'Agregar Mesero'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Asignaciones de hoy */}
        {asignacionesHoy.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Asignaciones de Hoy - {format(new Date(), "d 'de' MMMM", { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {asignacionesHoy.map((a: any) => (
                  <Badge key={a.id} variant="secondary" className="text-sm py-1.5 px-3">
                    {a.meseros?.nombre}: Mesas {a.mesa_inicio}-{a.mesa_fin} ({a.turno})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estadísticas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Rendimiento de Meseros
            </CardTitle>
            <Select value={periodoStats} onValueChange={setPeriodoStats}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Hoy</SelectItem>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="15">Últimos 15 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {estadisticas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {estadisticas.map((stat, index) => (
                  <Card key={stat.mesero_id} className={index === 0 ? 'border-primary/50 bg-primary/5' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold">{stat.nombre}</span>
                        {index === 0 && <Badge className="bg-primary">Top</Badge>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                          <p className="text-lg font-bold">S/ {stat.total_ventas.toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">Ventas</p>
                        </div>
                        <div>
                          <ClipboardList className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                          <p className="text-lg font-bold">{stat.ordenes_atendidas}</p>
                          <p className="text-xs text-muted-foreground">Órdenes</p>
                        </div>
                        <div>
                          <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                          <p className="text-lg font-bold">{stat.tiempo_promedio_min || '-'}</p>
                          <p className="text-xs text-muted-foreground">Min prom.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No hay datos de rendimiento. Las estadísticas aparecerán cuando se registren órdenes con meseros asignados.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lista de meseros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Equipo ({meseros.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : meseros.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay meseros registrados. Agrega uno para comenzar.
              </p>
            ) : (
              <div className="divide-y">
                {meseros.map(mesero => (
                  <div key={mesero.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${mesero.activo ? 'bg-primary' : 'bg-muted-foreground'}`}>
                        {mesero.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{mesero.nombre}</p>
                        {mesero.telefono && (
                          <p className="text-sm text-muted-foreground">{mesero.telefono}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Activo</span>
                        <Switch 
                          checked={mesero.activo} 
                          onCheckedChange={(checked) => toggleActivo.mutate({ id: mesero.id, activo: checked })}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(mesero)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
