import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, GripVertical, Package, FolderOpen } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Menu = Tables<'menus'>;
type MenuOpcion = Tables<'menu_opciones'>;
type MenuOpcionItem = Tables<'menu_opcion_items'>;
type Categoria = Tables<'categorias'>;
type Producto = Tables<'productos'>;

interface MenuOpcionesEditorProps {
  menu: Menu;
  onClose: () => void;
}

type OpcionWithItems = MenuOpcion & {
  items: (MenuOpcionItem & {
    categoria?: Categoria | null;
    producto?: Producto | null;
  })[];
};

export default function MenuOpcionesEditor({ menu, onClose }: MenuOpcionesEditorProps) {
  const [newOpcionNombre, setNewOpcionNombre] = useState('');
  const queryClient = useQueryClient();

  // Fetch opciones del menú con sus items
  const { data: opciones, isLoading: opcionesLoading } = useQuery({
    queryKey: ['menu-opciones', menu.id],
    queryFn: async () => {
      const { data: opcionesData, error: opcionesError } = await supabase
        .from('menu_opciones')
        .select('*')
        .eq('menu_id', menu.id)
        .order('orden', { ascending: true });
      
      if (opcionesError) throw opcionesError;
      
      // Fetch items para cada opción
      const opcionesWithItems: OpcionWithItems[] = await Promise.all(
        (opcionesData || []).map(async (opcion) => {
          const { data: items, error: itemsError } = await supabase
            .from('menu_opcion_items')
            .select(`
              *,
              categoria:categorias(*),
              producto:productos(*)
            `)
            .eq('menu_opcion_id', opcion.id);
          
          if (itemsError) throw itemsError;
          
          return {
            ...opcion,
            items: items || []
          };
        })
      );
      
      return opcionesWithItems;
    },
  });

  // Fetch categorías y productos disponibles
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
    mutationFn: async (nombre: string) => {
      const orden = (opciones?.length || 0);
      const { error } = await supabase
        .from('menu_opciones')
        .insert([{ menu_id: menu.id, nombre, orden }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      setNewOpcionNombre('');
      toast.success('Opción agregada');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteOpcionMutation = useMutation({
    mutationFn: async (opcionId: string) => {
      const { error } = await supabase
        .from('menu_opciones')
        .delete()
        .eq('id', opcionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      toast.success('Opción eliminada');
    },
    onError: (error) => toast.error(error.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ 
      opcionId, 
      categoriaId, 
      productoId, 
      costoAdicional 
    }: { 
      opcionId: string; 
      categoriaId?: string; 
      productoId?: string;
      costoAdicional: number;
    }) => {
      const { error } = await supabase
        .from('menu_opcion_items')
        .insert([{ 
          menu_opcion_id: opcionId, 
          categoria_id: categoriaId || null,
          producto_id: productoId || null,
          costo_adicional: costoAdicional
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      toast.success('Item agregado');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateItemCostoMutation = useMutation({
    mutationFn: async ({ itemId, costoAdicional }: { itemId: string; costoAdicional: number }) => {
      const { error } = await supabase
        .from('menu_opcion_items')
        .update({ costo_adicional: costoAdicional })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('menu_opcion_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      toast.success('Item eliminado');
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddOpcion = () => {
    if (!newOpcionNombre.trim()) {
      toast.error('Ingresa un nombre para la opción');
      return;
    }
    createOpcionMutation.mutate(newOpcionNombre.trim());
  };

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
          Configura las opciones del menú. Por ejemplo:
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li><strong>Entrada:</strong> Toda la categoría "Entradas"</li>
          <li><strong>Plato de fondo:</strong> Categoría "Segundos"</li>
          <li><strong>Bebida:</strong> Productos específicos (Chicha, Limonada) o toda la categoría con costo adicional para gaseosas</li>
        </ul>
      </div>

      {/* Agregar nueva opción */}
      <div className="flex gap-2">
        <Input
          placeholder="Nueva opción (ej: Entrada, Plato de fondo, Bebida)"
          value={newOpcionNombre}
          onChange={(e) => setNewOpcionNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddOpcion()}
        />
        <Button onClick={handleAddOpcion} disabled={createOpcionMutation.isPending}>
          {createOpcionMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Lista de opciones */}
      {opciones?.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Agrega opciones para configurar el menú
        </p>
      ) : (
        <div className="space-y-4">
          {opciones?.map((opcion) => (
            <OpcionCard
              key={opcion.id}
              opcion={opcion}
              categorias={categorias || []}
              productos={productos || []}
              onDelete={() => {
                if (confirm(`¿Eliminar la opción "${opcion.nombre}"?`)) {
                  deleteOpcionMutation.mutate(opcion.id);
                }
              }}
              onAddItem={(data) => addItemMutation.mutate({ opcionId: opcion.id, ...data })}
              onUpdateItemCosto={(itemId, costo) => updateItemCostoMutation.mutate({ itemId, costoAdicional: costo })}
              onDeleteItem={(itemId) => deleteItemMutation.mutate(itemId)}
              isDeleting={deleteOpcionMutation.isPending}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// Componente para cada opción
interface OpcionCardProps {
  opcion: OpcionWithItems;
  categorias: Categoria[];
  productos: Producto[];
  onDelete: () => void;
  onAddItem: (data: { categoriaId?: string; productoId?: string; costoAdicional: number }) => void;
  onUpdateItemCosto: (itemId: string, costo: number) => void;
  onDeleteItem: (itemId: string) => void;
  isDeleting: boolean;
}

function OpcionCard({ 
  opcion, 
  categorias, 
  productos, 
  onDelete, 
  onAddItem,
  onUpdateItemCosto,
  onDeleteItem,
  isDeleting 
}: OpcionCardProps) {
  const [addMode, setAddMode] = useState<'categoria' | 'producto' | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [costoAdicional, setCostoAdicional] = useState(0);

  const handleAdd = () => {
    if (!selectedId) {
      toast.error('Selecciona una opción');
      return;
    }
    onAddItem({
      categoriaId: addMode === 'categoria' ? selectedId : undefined,
      productoId: addMode === 'producto' ? selectedId : undefined,
      costoAdicional
    });
    setAddMode(null);
    setSelectedId('');
    setCostoAdicional(0);
  };

  // Filtrar categorías y productos ya agregados
  const addedCategoriaIds = opcion.items
    .filter(i => i.categoria_id)
    .map(i => i.categoria_id);
  const addedProductoIds = opcion.items
    .filter(i => i.producto_id)
    .map(i => i.producto_id);
  
  const availableCategorias = categorias.filter(c => !addedCategoriaIds.includes(c.id));
  const availableProductos = productos.filter(p => !addedProductoIds.includes(p.id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            <CardTitle className="text-base">{opcion.nombre}</CardTitle>
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
        {/* Items de esta opción */}
        {opcion.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin items configurados
          </p>
        ) : (
          <div className="space-y-2">
            {opcion.items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {item.categoria ? (
                    <>
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        Categoría: {item.categoria.nombre}
                      </span>
                      <Badge variant="outline">Todos</Badge>
                    </>
                  ) : item.producto ? (
                    <>
                      <Package className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">
                        {item.producto.nombre}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">+S/</span>
                    <Input
                      type="number"
                      step="0.5"
                      className="w-16 h-8 text-sm"
                      value={item.costo_adicional ?? 0}
                      onChange={(e) => onUpdateItemCosto(item.id, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => onDeleteItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agregar item */}
        {addMode === null ? (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setAddMode('categoria')}
              disabled={availableCategorias.length === 0}
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Agregar categoría
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setAddMode('producto')}
              disabled={availableProductos.length === 0}
            >
              <Package className="h-4 w-4 mr-1" />
              Agregar producto
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                {addMode === 'categoria' ? 'Categoría' : 'Producto'}
              </label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {addMode === 'categoria' 
                    ? availableCategorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </SelectItem>
                      ))
                    : availableProductos.map((prod) => (
                        <SelectItem key={prod.id} value={prod.id}>
                          {prod.nombre} - S/{Number(prod.precio).toFixed(2)}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground mb-1 block">
                Costo extra
              </label>
              <Input
                type="number"
                step="0.5"
                value={costoAdicional}
                onChange={(e) => setCostoAdicional(parseFloat(e.target.value) || 0)}
                placeholder="+S/"
              />
            </div>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setAddMode(null);
                setSelectedId('');
                setCostoAdicional(0);
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
