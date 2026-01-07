import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Gift, Loader2, History, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Recompensa {
  id: string;
  nombre: string;
  puntos_requeridos: number;
  porcentaje_descuento: number;
  activo: boolean;
}

interface DescuentoAplicado {
  id: string;
  user_id: string;
  usado: boolean;
  orden_id: string | null;
  created_at: string;
  usado_at: string | null;
  puntos_usados: number;
  recompensa_id: string;
  recompensa: {
    nombre: string;
    porcentaje_descuento: number;
  } | null;
  profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function RecompensasAdmin() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecompensa, setEditingRecompensa] = useState<Recompensa | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    puntos_requeridos: '',
    porcentaje_descuento: '',
    activo: true,
  });

  const { data: recompensas, isLoading } = useQuery({
    queryKey: ['admin-recompensas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recompensas')
        .select('*')
        .order('puntos_requeridos', { ascending: true });
      if (error) throw error;
      return data as Recompensa[];
    },
  });

  const { data: descuentosAplicados, isLoading: loadingDescuentos } = useQuery({
    queryKey: ['descuentos-aplicados'],
    queryFn: async () => {
      // Get discounts with reward info
      const { data: descuentos, error } = await supabase
        .from('descuentos_activos')
        .select(`
          *,
          recompensa:recompensas(nombre, porcentaje_descuento)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get profiles for each user_id
      const userIds = [...new Set(descuentos.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      // Map profiles to descuentos
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return descuentos.map(d => ({
        ...d,
        profile: profileMap.get(d.user_id) || null
      })) as DescuentoAplicado[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('recompensas').insert({
        nombre: data.nombre,
        puntos_requeridos: parseInt(data.puntos_requeridos),
        porcentaje_descuento: parseInt(data.porcentaje_descuento),
        activo: data.activo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recompensas'] });
      toast.success('Recompensa creada exitosamente');
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Error al crear la recompensa: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('recompensas')
        .update({
          nombre: data.nombre,
          puntos_requeridos: parseInt(data.puntos_requeridos),
          porcentaje_descuento: parseInt(data.porcentaje_descuento),
          activo: data.activo,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recompensas'] });
      toast.success('Recompensa actualizada');
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recompensas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recompensas'] });
      toast.success('Recompensa eliminada');
    },
    onError: (error: any) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from('recompensas')
        .update({ activo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recompensas'] });
    },
    onError: (error: any) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      puntos_requeridos: '',
      porcentaje_descuento: '',
      activo: true,
    });
    setEditingRecompensa(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (recompensa: Recompensa) => {
    setEditingRecompensa(recompensa);
    setFormData({
      nombre: recompensa.nombre,
      puntos_requeridos: recompensa.puntos_requeridos.toString(),
      porcentaje_descuento: recompensa.porcentaje_descuento.toString(),
      activo: recompensa.activo,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.puntos_requeridos || !formData.porcentaje_descuento) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (editingRecompensa) {
      updateMutation.mutate({ id: editingRecompensa.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Stats de descuentos
  const totalDescuentos = descuentosAplicados?.length || 0;
  const descuentosUsados = descuentosAplicados?.filter(d => d.usado).length || 0;
  const descuentosPendientes = totalDescuentos - descuentosUsados;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              Gestión de Recompensas
            </h1>
            <p className="text-muted-foreground">
              Configura los descuentos que los clientes pueden canjear con sus puntos
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Recompensa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingRecompensa ? 'Editar Recompensa' : 'Nueva Recompensa'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Descuento Bronce"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="puntos">Puntos Requeridos</Label>
                  <Input
                    id="puntos"
                    type="number"
                    placeholder="Ej: 100"
                    min="1"
                    value={formData.puntos_requeridos}
                    onChange={(e) => setFormData({ ...formData, puntos_requeridos: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="descuento">Porcentaje de Descuento</Label>
                  <Input
                    id="descuento"
                    type="number"
                    placeholder="Ej: 15"
                    min="1"
                    max="100"
                    value={formData.porcentaje_descuento}
                    onChange={(e) => setFormData({ ...formData, porcentaje_descuento: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="activo">Activo</Label>
                  <Switch
                    id="activo"
                    checked={formData.activo}
                    onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending} className="flex-1">
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingRecompensa ? (
                      'Guardar cambios'
                    ) : (
                      'Crear recompensa'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="recompensas">
          <TabsList>
            <TabsTrigger value="recompensas" className="gap-2">
              <Gift className="h-4 w-4" />
              Recompensas
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-2">
              <History className="h-4 w-4" />
              Descuentos Aplicados
              {totalDescuentos > 0 && (
                <Badge variant="secondary" className="ml-1">{totalDescuentos}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recompensas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recompensas Configuradas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : recompensas && recompensas.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-center">Puntos</TableHead>
                        <TableHead className="text-center">Descuento</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recompensas.map((recompensa) => (
                        <TableRow key={recompensa.id}>
                          <TableCell className="font-medium">{recompensa.nombre}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{recompensa.puntos_requeridos} pts</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge>{recompensa.porcentaje_descuento}% OFF</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={recompensa.activo}
                              onCheckedChange={(checked) => 
                                toggleActivoMutation.mutate({ id: recompensa.id, activo: checked })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(recompensa)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('¿Eliminar esta recompensa?')) {
                                    deleteMutation.mutate(recompensa.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No hay recompensas configuradas</p>
                    <p className="text-sm">Crea la primera recompensa para tus clientes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial" className="mt-4 space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Activados</p>
                      <p className="text-2xl font-bold">{totalDescuentos}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Usados</p>
                      <p className="text-2xl font-bold">{descuentosUsados}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-orange-500/10">
                      <Clock className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendientes</p>
                      <p className="text-2xl font-bold">{descuentosPendientes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historial de Descuentos</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDescuentos ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : descuentosAplicados && descuentosAplicados.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Recompensa</TableHead>
                        <TableHead className="text-center">Puntos</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead>Fecha Activación</TableHead>
                        <TableHead>Fecha Uso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {descuentosAplicados.map((descuento) => (
                        <TableRow key={descuento.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {descuento.profile?.full_name || 'Sin nombre'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {descuento.profile?.email || '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{descuento.recompensa?.nombre || '-'}</p>
                              <Badge variant="outline">
                                {descuento.recompensa?.porcentaje_descuento}% OFF
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{descuento.puntos_usados} pts</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {descuento.usado ? (
                              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Usado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600">
                                <Clock className="h-3 w-3 mr-1" />
                                Pendiente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(descuento.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>
                            {descuento.usado_at 
                              ? format(new Date(descuento.usado_at), "dd MMM yyyy, HH:mm", { locale: es })
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No hay descuentos registrados</p>
                    <p className="text-sm">Aparecerán aquí cuando los clientes activen recompensas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
