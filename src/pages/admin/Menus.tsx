import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Settings, UtensilsCrossed } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import MenuOpcionesEditor from '@/components/admin/MenuOpcionesEditor';

type Menu = Tables<'menus'>;

const menuSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  precio: z.number().min(0, 'El precio debe ser positivo'),
  activo: z.boolean(),
  imagen_url: z.string().optional(),
});

type MenuFormData = z.infer<typeof menuSchema>;

export default function Menus() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [configuringMenu, setConfiguringMenu] = useState<Menu | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: { nombre: '', descripcion: '', precio: 0, activo: true, imagen_url: '' },
  });

  const { data: menus, isLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Menu[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MenuFormData) => {
      const { data: newMenu, error } = await supabase
        .from('menus')
        .insert([{ 
          nombre: data.nombre, 
          descripcion: data.descripcion || null,
          precio: data.precio, 
          activo: data.activo,
          imagen_url: data.imagen_url || null 
        }])
        .select()
        .single();
      if (error) throw error;
      return newMenu;
    },
    onSuccess: (newMenu) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      toast.success('Menú creado. Ahora configura las opciones.');
      closeDialog();
      setConfiguringMenu(newMenu);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MenuFormData }) => {
      const { error } = await supabase
        .from('menus')
        .update({ 
          nombre: data.nombre, 
          descripcion: data.descripcion || null,
          precio: data.precio, 
          activo: data.activo,
          imagen_url: data.imagen_url || null 
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      toast.success('Menú actualizado');
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      toast.success('Menú eliminado');
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateDialog = () => {
    setEditingMenu(null);
    form.reset({ nombre: '', descripcion: '', precio: 0, activo: true, imagen_url: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (menu: Menu) => {
    setEditingMenu(menu);
    form.reset({ 
      nombre: menu.nombre, 
      descripcion: menu.descripcion || '',
      precio: Number(menu.precio), 
      activo: menu.activo ?? true,
      imagen_url: menu.imagen_url || '' 
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMenu(null);
    form.reset();
  };

  const onSubmit = (data: MenuFormData) => {
    if (editingMenu) {
      updateMutation.mutate({ id: editingMenu.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (menu: Menu) => {
    if (confirm(`¿Eliminar el menú "${menu.nombre}"?`)) {
      deleteMutation.mutate(menu.id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Menús / Combos</h1>
            <p className="text-muted-foreground mt-1">Crea combos con precio especial (ej: entrada + fondo + bebida)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Menú
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingMenu ? 'Editar Menú' : 'Nuevo Menú'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Menú Ejecutivo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Ej: Incluye entrada, plato de fondo y bebida" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="precio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio base (S/)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imagen_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de imagen (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="activo"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Activo</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Mostrar en el menú público
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingMenu ? 'Guardar' : 'Crear'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : menus?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay menús aún.</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer menú
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {menus?.map((menu) => (
              <Card key={menu.id} className="animate-fade-in">
                {menu.imagen_url && (
                  <div className="aspect-video relative overflow-hidden rounded-t-lg">
                    <img 
                      src={menu.imagen_url} 
                      alt={menu.nombre}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{menu.nombre}</CardTitle>
                      {menu.descripcion && (
                        <CardDescription className="mt-1">
                          {menu.descripcion}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={menu.activo ? 'default' : 'secondary'}>
                      {menu.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary mb-4">
                    S/ {Number(menu.precio).toFixed(2)}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      onClick={() => setConfiguringMenu(menu)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(menu)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(menu)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog para configurar opciones del menú */}
      <Dialog open={!!configuringMenu} onOpenChange={(open) => !open && setConfiguringMenu(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Configurar: {configuringMenu?.nombre}
            </DialogTitle>
          </DialogHeader>
          {configuringMenu && (
            <MenuOpcionesEditor 
              menu={configuringMenu} 
              onClose={() => setConfiguringMenu(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
