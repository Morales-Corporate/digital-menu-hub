import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, GripVertical, FolderOpen, DollarSign } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Menu = Tables<'menus'>;
type MenuOpcion = Tables<'menu_opciones'>;
type Categoria = Tables<'categorias'>;
type Producto = Tables<'productos'>;

interface MenuOpcionesEditorProps {
  menu: Menu;
  onClose: () => void;
}

type OpcionWithCategoria = MenuOpcion & {
  categoria?: Categoria | null;
};

// Productos con costo extra para esta opción
interface ProductoCostoExtra {
  id: string;
  menu_opcion_id: string;
  producto_id: string;
  costo_adicional: number;
  producto?: Producto | null;
}

export default function MenuOpcionesEditor({ menu, onClose }: MenuOpcionesEditorProps) {
  const [newOpcionNombre, setNewOpcionNombre] = useState('');
  const [newOpcionCategoriaId, setNewOpcionCategoriaId] = useState('');
  const queryClient = useQueryClient();

  // Fetch opciones del menú con sus categorías
  const { data: opciones, isLoading: opcionesLoading } = useQuery({
    queryKey: ['menu-opciones', menu.id],
    queryFn: async () => {
      const { data: opcionesData, error: opcionesError } = await supabase
        .from('menu_opciones')
        .select(`
          *,
          categoria:categorias(*)
        `)
        .eq('menu_id', menu.id)
        .order('orden', { ascending: true });
      
      if (opcionesError) throw opcionesError;
      
      return (opcionesData || []) as OpcionWithCategoria[];
    },
  });

  // Fetch productos con costo extra
  const { data: productosConExtra = [] } = useQuery({
    queryKey: ['menu-productos-extra', menu.id],
    queryFn: async () => {
      const opcionIds = opciones?.map(o => o.id) || [];
      if (opcionIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('menu_opcion_items')
        .select(`
          *,
          producto:productos(*)
        `)
        .in('menu_opcion_id', opcionIds)
        .not('producto_id', 'is', null);
      
      if (error) throw error;
      return (data || []) as ProductoCostoExtra[];
    },
    enabled: !!opciones && opciones.length > 0,
  });

  // Fetch categorías disponibles
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

  // Fetch productos para mostrar en cada categoría
  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('disponible', true)
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data as Producto[];
    },
  });

  // Mutations
  const createOpcionMutation = useMutation({
    mutationFn: async ({ nombre, categoriaId }: { nombre: string; categoriaId: string }) => {
      const orden = (opciones?.length || 0);
      const { error } = await supabase
        .from('menu_opciones')
        .insert([{ menu_id: menu.id, nombre, orden, categoria_id: categoriaId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      setNewOpcionNombre('');
      setNewOpcionCategoriaId('');
      toast.success('Subclasificación agregada');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteOpcionMutation = useMutation({
    mutationFn: async (opcionId: string) => {
      // Primero eliminar items relacionados
      await supabase.from('menu_opcion_items').delete().eq('menu_opcion_id', opcionId);
      const { error } = await supabase.from('menu_opciones').delete().eq('id', opcionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      queryClient.invalidateQueries({ queryKey: ['menu-productos-extra', menu.id] });
      toast.success('Subclasificación eliminada');
    },
    onError: (error) => toast.error(error.message),
  });

  const addExtraCostMutation = useMutation({
    mutationFn: async ({ opcionId, productoId, costo }: { opcionId: string; productoId: string; costo: number }) => {
      const { error } = await supabase
        .from('menu_opcion_items')
        .insert([{ menu_opcion_id: opcionId, producto_id: productoId, costo_adicional: costo }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-productos-extra', menu.id] });
      toast.success('Costo adicional configurado');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateExtraCostMutation = useMutation({
    mutationFn: async ({ itemId, costo }: { itemId: string; costo: number }) => {
      const { error } = await supabase
        .from('menu_opcion_items')
        .update({ costo_adicional: costo })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-productos-extra', menu.id] });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteExtraCostMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('menu_opcion_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-productos-extra', menu.id] });
      toast.success('Costo adicional eliminado');
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddOpcion = () => {
    if (!newOpcionNombre.trim()) {
      toast.error('Ingresa un nombre para la subclasificación');
      return;
    }
    if (!newOpcionCategoriaId) {
      toast.error('Selecciona una categoría');
      return;
    }
    createOpcionMutation.mutate({ nombre: newOpcionNombre.trim(), categoriaId: newOpcionCategoriaId });
  };

  // Categorías ya usadas
  const usedCategoriaIds = opciones?.map(o => o.categoria_id).filter(Boolean) || [];
  const availableCategorias = categorias?.filter(c => !usedCategoriaIds.includes(c.id)) || [];

  if (opcionesLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-2">
          <strong>Configuración simplificada:</strong>
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Agrega subclasificaciones (Entrada, Fondo, Bebida) vinculadas a categorías</li>
          <li>Todos los productos de esa categoría estarán disponibles automáticamente</li>
          <li>Opcionalmente, marca productos con costo adicional (ej: gaseosa +S/2)</li>
        </ul>
      </div>

      {/* Agregar nueva subclasificación */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Agregar subclasificación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nombre (ej: Entrada)"
              value={newOpcionNombre}
              onChange={(e) => setNewOpcionNombre(e.target.value)}
              className="flex-1"
            />
            <Select value={newOpcionCategoriaId} onValueChange={setNewOpcionCategoriaId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {availableCategorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddOpcion} disabled={createOpcionMutation.isPending}>
              {createOpcionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de subclasificaciones */}
      {opciones?.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Agrega subclasificaciones para configurar el menú
        </p>
      ) : (
        <div className="space-y-4">
          {opciones?.map((opcion) => {
            const categoriaNombre = opcion.categoria?.nombre || 'Sin categoría';
            const productosDeCategoria = productos?.filter(p => p.categoria_id === opcion.categoria_id) || [];
            const extrasDeOpcion = productosConExtra.filter(e => e.menu_opcion_id === opcion.id);
            
            return (
              <SubclasificacionCard
                key={opcion.id}
                opcion={opcion}
                categoriaNombre={categoriaNombre}
                productosDeCategoria={productosDeCategoria}
                extrasDeOpcion={extrasDeOpcion}
                onDelete={() => {
                  if (confirm(`¿Eliminar "${opcion.nombre}"?`)) {
                    deleteOpcionMutation.mutate(opcion.id);
                  }
                }}
                onAddExtra={(productoId, costo) => 
                  addExtraCostMutation.mutate({ opcionId: opcion.id, productoId, costo })
                }
                onUpdateExtra={(itemId, costo) => 
                  updateExtraCostMutation.mutate({ itemId, costo })
                }
                onDeleteExtra={(itemId) => deleteExtraCostMutation.mutate(itemId)}
                isDeleting={deleteOpcionMutation.isPending}
              />
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// Componente para cada subclasificación
interface SubclasificacionCardProps {
  opcion: OpcionWithCategoria;
  categoriaNombre: string;
  productosDeCategoria: Producto[];
  extrasDeOpcion: ProductoCostoExtra[];
  onDelete: () => void;
  onAddExtra: (productoId: string, costo: number) => void;
  onUpdateExtra: (itemId: string, costo: number) => void;
  onDeleteExtra: (itemId: string) => void;
  isDeleting: boolean;
}

function SubclasificacionCard({ 
  opcion, 
  categoriaNombre,
  productosDeCategoria,
  extrasDeOpcion,
  onDelete, 
  onAddExtra,
  onUpdateExtra,
  onDeleteExtra,
  isDeleting 
}: SubclasificacionCardProps) {
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [selectedProductoId, setSelectedProductoId] = useState('');
  const [costoExtra, setCostoExtra] = useState(2);

  const handleAddExtra = () => {
    if (!selectedProductoId) {
      toast.error('Selecciona un producto');
      return;
    }
    onAddExtra(selectedProductoId, costoExtra);
    setShowAddExtra(false);
    setSelectedProductoId('');
    setCostoExtra(2);
  };

  // Productos sin costo extra configurado
  const productosConExtraIds = extrasDeOpcion.map(e => e.producto_id);
  const productosDisponibles = productosDeCategoria.filter(p => !productosConExtraIds.includes(p.id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            <div>
              <CardTitle className="text-base">{opcion.nombre}</CardTitle>
              <div className="flex items-center gap-1 mt-0.5">
                <FolderOpen className="h-3 w-3 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Categoría: {categoriaNombre}
                </span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {productosDeCategoria.length} productos
                </Badge>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Lista de productos de la categoría */}
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Productos disponibles (automáticos):
          </p>
          <div className="flex flex-wrap gap-1">
            {productosDeCategoria.map((prod) => {
              const extra = extrasDeOpcion.find(e => e.producto_id === prod.id);
              return (
                <Badge 
                  key={prod.id} 
                  variant={extra ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {prod.nombre}
                  {extra && ` +S/${Number(extra.costo_adicional).toFixed(0)}`}
                </Badge>
              );
            })}
            {productosDeCategoria.length === 0 && (
              <span className="text-xs text-muted-foreground">Sin productos en esta categoría</span>
            )}
          </div>
        </div>

        {/* Productos con costo extra */}
        {extrasDeOpcion.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Productos con costo adicional:
            </p>
            {extrasDeOpcion.map((extra) => (
              <div 
                key={extra.id} 
                className="flex items-center justify-between gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg"
              >
                <span className="text-sm">{extra.producto?.nombre}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">+S/</span>
                    <Input
                      type="number"
                      step="0.5"
                      className="w-16 h-7 text-sm"
                      value={extra.costo_adicional ?? 0}
                      onChange={(e) => onUpdateExtra(extra.id, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => onDeleteExtra(extra.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agregar costo extra */}
        {!showAddExtra ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAddExtra(true)}
            disabled={productosDisponibles.length === 0}
            className="w-full"
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Agregar producto con costo extra
          </Button>
        ) : (
          <div className="flex gap-2 items-end p-3 border rounded-lg bg-muted/30">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Producto</label>
              <Select value={selectedProductoId} onValueChange={setSelectedProductoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {productosDisponibles.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id}>
                      {prod.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <label className="text-xs text-muted-foreground mb-1 block">+S/</label>
              <Input
                type="number"
                step="0.5"
                value={costoExtra}
                onChange={(e) => setCostoExtra(parseFloat(e.target.value) || 0)}
              />
            </div>
            <Button size="sm" onClick={handleAddExtra}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setShowAddExtra(false);
                setSelectedProductoId('');
                setCostoExtra(2);
              }}
            >
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
