import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Loader2, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Categoria {
  id: string;
  nombre: string;
  orden: number | null;
  parent_id: string | null;
  created_at: string | null;
}

const categoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  orden: z.number().int().min(0, 'El orden debe ser positivo'),
  parent_id: z.string().nullable(),
});

type CategoriaFormData = z.infer<typeof categoriaSchema>;

export default function Categorias() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const form = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: '', orden: 0, parent_id: null },
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

  // Organize into hierarchy
  const { rootCategories, childrenMap } = (() => {
    if (!categorias) return { rootCategories: [], childrenMap: {} };
    
    const roots: Categoria[] = [];
    const children: Record<string, Categoria[]> = {};
    
    for (const cat of categorias) {
      if (cat.parent_id === null) {
        roots.push(cat);
      } else {
        if (!children[cat.parent_id]) {
          children[cat.parent_id] = [];
        }
        children[cat.parent_id].push(cat);
      }
    }
    
    roots.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    for (const parentId of Object.keys(children)) {
      children[parentId].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    }
    
    return { rootCategories: roots, childrenMap: children };
  })();

  const createMutation = useMutation({
    mutationFn: async (data: CategoriaFormData) => {
      const { error } = await supabase.from('categorias').insert([{ 
        nombre: data.nombre, 
        orden: data.orden,
        parent_id: data.parent_id 
      }]);
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
      const { error } = await supabase.from('categorias').update({
        nombre: data.nombre,
        orden: data.orden,
        parent_id: data.parent_id
      }).eq('id', id);
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

  const openCreateDialog = (parentId: string | null = null) => {
    setEditingCategoria(null);
    const nextOrden = parentId 
      ? (childrenMap[parentId]?.length ?? 0)
      : rootCategories.length;
    form.reset({ nombre: '', orden: nextOrden, parent_id: parentId });
    setDialogOpen(true);
  };

  const openEditDialog = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    form.reset({ 
      nombre: categoria.nombre, 
      orden: categoria.orden ?? 0,
      parent_id: categoria.parent_id 
    });
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
    const hasChildren = childrenMap[categoria.id]?.length > 0;
    const message = hasChildren 
      ? `¿Eliminar "${categoria.nombre}" y todas sus subcategorías?`
      : `¿Eliminar la categoría "${categoria.nombre}"?`;
    if (confirm(message)) {
      deleteMutation.mutate(categoria.id);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedRoots(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const renderSubcategory = (subcat: Categoria) => (
    <div key={subcat.id} className="flex items-center gap-3 py-2 px-3 ml-8 border-l-2 border-primary/20">
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <span className="font-medium text-sm">{subcat.nombre}</span>
        <Badge variant="outline" className="ml-2 text-[10px]">Subcategoría</Badge>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(subcat)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => handleDelete(subcat)}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );

  const renderRootCategory = (root: Categoria) => {
    const children = childrenMap[root.id] || [];
    const isExpanded = expandedRoots.has(root.id);
    
    return (
      <Card key={root.id} className="animate-fade-in">
        <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(root.id)}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground/50 cursor-grab" />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-primary" />
                  ) : (
                    <Folder className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div className="flex-1">
                <h3 className="font-medium">{root.nombre}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px]">Clasificación</Badge>
                  {children.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {children.length} subcategoría{children.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => openCreateDialog(root.id)}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Subcategoría
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(root)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => handleDelete(root)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
          <CollapsibleContent>
            <div className="pb-3">
              {children.map(renderSubcategory)}
              {children.length === 0 && (
                <p className="text-xs text-muted-foreground ml-12 py-2">
                  Sin subcategorías. Los productos asignados aparecerán directamente.
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Categorías</h1>
            <p className="text-muted-foreground mt-1">
              Organiza los productos en clasificaciones y subcategorías
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreateDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Clasificación
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingCategoria 
                    ? 'Editar Categoría' 
                    : form.getValues('parent_id') 
                      ? 'Nueva Subcategoría' 
                      : 'Nueva Clasificación'}
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
                          <Input placeholder="Ej: Platos de Menú" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="parent_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clasificación padre (opcional)</FormLabel>
                        <Select 
                          value={field.value || 'none'} 
                          onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sin padre (es clasificación principal)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin padre (clasificación principal)</SelectItem>
                            {rootCategories
                              .filter(c => c.id !== editingCategoria?.id)
                              .map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
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

        <div className="bg-secondary/30 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Estructura:</strong> Crea clasificaciones principales (ej: "Menú Criollo", "Platos a la Carta") 
            y dentro de cada una agrega subcategorías (ej: "Entradas", "Platos de Fondo", "Bebidas").
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rootCategories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">No hay clasificaciones aún.</p>
              <Button onClick={() => openCreateDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera clasificación
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rootCategories.map(renderRootCategory)}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
