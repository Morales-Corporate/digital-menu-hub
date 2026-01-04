import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ImageIcon, Package } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Producto = Tables<'productos'>;
type Categoria = Tables<'categorias'>;

const productoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  precio: z.number().min(0, 'El precio debe ser positivo'),
  imagen_url: z.string().url('URL inválida').optional().or(z.literal('')),
  categoria_id: z.string().optional(),
  disponible: z.boolean(),
  stock: z.number().min(0, 'El stock debe ser positivo').nullable(),
});

type ProductoFormData = z.infer<typeof productoSchema>;

export default function Productos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<ProductoFormData>({
    resolver: zodResolver(productoSchema),
    defaultValues: { 
      nombre: '', 
      descripcion: '', 
      precio: 0, 
      imagen_url: '', 
      categoria_id: undefined,
      disponible: true,
      stock: null
    },
  });

  const { data: productos, isLoading: loadingProductos } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data as Producto[];
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('orden', { ascending: true });
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductoFormData) => {
      const insertData = {
        nombre: data.nombre,
        precio: data.precio,
        disponible: data.disponible,
        imagen_url: data.imagen_url || null,
        descripcion: data.descripcion || null,
        categoria_id: data.categoria_id || null,
        stock: data.stock,
      };
      const { error } = await supabase.from('productos').insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto creado');
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductoFormData }) => {
      const updateData = {
        nombre: data.nombre,
        precio: data.precio,
        disponible: data.disponible,
        imagen_url: data.imagen_url || null,
        descripcion: data.descripcion || null,
        categoria_id: data.categoria_id || null,
        stock: data.stock,
      };
      const { error } = await supabase.from('productos').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto actualizado');
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto eliminado');
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateDialog = () => {
    setEditingProducto(null);
    form.reset({ 
      nombre: '', 
      descripcion: '', 
      precio: 0, 
      imagen_url: '', 
      categoria_id: undefined,
      disponible: true,
      stock: null
    });
    setDialogOpen(true);
  };

  const openEditDialog = (producto: Producto) => {
    setEditingProducto(producto);
    form.reset({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: Number(producto.precio),
      imagen_url: producto.imagen_url ?? '',
      categoria_id: producto.categoria_id ?? undefined,
      disponible: producto.disponible ?? true,
      stock: producto.stock ?? null,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProducto(null);
    form.reset();
  };

  const onSubmit = (data: ProductoFormData) => {
    if (editingProducto) {
      updateMutation.mutate({ id: editingProducto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (producto: Producto) => {
    if (confirm(`¿Eliminar el producto "${producto.nombre}"?`)) {
      deleteMutation.mutate(producto.id);
    }
  };

  const getCategoriaName = (categoriaId: string | null) => {
    if (!categoriaId) return 'Sin categoría';
    return categorias?.find(c => c.id === categoriaId)?.nombre ?? 'Sin categoría';
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Productos</h1>
            <p className="text-muted-foreground mt-1">Gestiona los platos de tu menú</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
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
                          <Input placeholder="Ej: Pasta Carbonara" {...field} />
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
                            placeholder="Descripción del plato..." 
                            className="resize-none"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="precio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio</FormLabel>
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
                      name="categoria_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categorias?.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="imagen_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de imagen</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Stock disponible
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            placeholder="Vacío = ilimitado"
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === '' ? null : parseInt(val, 10));
                            }}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Deja vacío para stock ilimitado. 0 = agotado.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disponible"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <FormLabel className="text-base">Disponible</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Mostrar este producto en el menú
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                      {editingProducto ? 'Guardar' : 'Crear'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {loadingProductos ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : productos?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No hay productos aún.</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer producto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {productos?.map((producto) => (
              <Card key={producto.id} className="overflow-hidden animate-fade-in">
                <div className="aspect-video bg-muted relative">
                  {producto.imagen_url ? (
                    <img 
                      src={producto.imagen_url} 
                      alt={producto.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  {!producto.disponible && (
                    <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
                      <span className="text-background font-medium px-3 py-1 rounded-full bg-destructive text-sm">
                        No disponible
                      </span>
                    </div>
                  )}
                  {producto.disponible && producto.stock === 0 && (
                    <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
                      <span className="text-background font-medium px-3 py-1 rounded-full bg-orange-500 text-sm">
                        Agotado
                      </span>
                    </div>
                  )}
                  {producto.stock !== null && producto.stock > 0 && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-background/90 text-foreground font-medium px-2 py-1 rounded-full text-xs flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {producto.stock}
                      </span>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-medium line-clamp-1">{producto.nombre}</h3>
                    <span className="font-semibold text-primary whitespace-nowrap">
                      ${Number(producto.precio).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {producto.descripcion || 'Sin descripción'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                      {getCategoriaName(producto.categoria_id)}
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(producto)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(producto)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}