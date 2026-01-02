import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Categoria = Tables<'categorias'>;

const categoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  orden: z.number().int().min(0, 'El orden debe ser positivo'),
});

type CategoriaFormData = z.infer<typeof categoriaSchema>;

export default function Categorias() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: '', orden: 0 },
  });

  const { data: categorias, isLoading } = useQuery({
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
    mutationFn: async (data: CategoriaFormData) => {
      const { error } = await supabase.from('categorias').insert([{ nombre: data.nombre, orden: data.orden }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría creada');
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoriaFormData }) => {
      const { error } = await supabase.from('categorias').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría actualizada');
      closeDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría eliminada');
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateDialog = () => {
    setEditingCategoria(null);
    form.reset({ nombre: '', orden: (categorias?.length ?? 0) });
    setDialogOpen(true);
  };

  const openEditDialog = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    form.reset({ nombre: categoria.nombre, orden: categoria.orden ?? 0 });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategoria(null);
    form.reset();
  };

  const onSubmit = (data: CategoriaFormData) => {
    if (editingCategoria) {
      updateMutation.mutate({ id: editingCategoria.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (categoria: Categoria) => {
    if (confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) {
      deleteMutation.mutate(categoria.id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Categorías</h1>
            <p className="text-muted-foreground mt-1">Organiza los productos de tu menú</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Categoría
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
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
                          <Input placeholder="Ej: Entradas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="orden"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orden</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingCategoria ? 'Guardar' : 'Crear'}
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
        ) : categorias?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No hay categorías aún.</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera categoría
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {categorias?.map((categoria) => (
              <Card key={categoria.id} className="animate-fade-in">
                <CardContent className="flex items-center gap-4 py-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground/50 cursor-grab" />
                  <div className="flex-1">
                    <h3 className="font-medium">{categoria.nombre}</h3>
                    <p className="text-sm text-muted-foreground">Orden: {categoria.orden}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(categoria)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(categoria)}
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
    </AdminLayout>
  );
}