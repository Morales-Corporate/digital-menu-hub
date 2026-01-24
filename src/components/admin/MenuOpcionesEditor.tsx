import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, FolderOpen, DollarSign, Check } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Menu = Tables<'menus'>;
type Categoria = Tables<'categorias'>;
type Producto = Tables<'productos'>;

interface MenuOpcionesEditorProps {
  menu: Menu;
  onClose: () => void;
}

interface MenuOpcion {
  id: string;
  menu_id: string;
  nombre: string;
  orden: number | null;
  categoria_id: string | null;
  categoria?: Categoria | null;
}

interface ProductoCostoExtra {
  id: string;
  menu_opcion_id: string;
  producto_id: string;
  costo_adicional: number;
  producto?: Producto | null;
}

export default function MenuOpcionesEditor({ menu, onClose }: MenuOpcionesEditorProps) {
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('');
  const queryClient = useQueryClient();

  // Fetch opciones del menú
  const { data: opciones = [], isLoading: opcionesLoading } = useQuery({
    queryKey: ['menu-opciones', menu.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_opciones')
        .select(`*, categoria:categorias(*)`)
        .eq('menu_id', menu.id)
        .order('orden');
      
      if (error) throw error;
      return (data || []) as MenuOpcion[];
    },
  });

  // Fetch productos con costo extra
  const { data: productosConExtra = [] } = useQuery({
    queryKey: ['menu-productos-extra', menu.id],
    queryFn: async () => {
      const opcionIds = opciones.map(o => o.id);
      if (opcionIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('menu_opcion_items')
        .select(`*, producto:productos(*)`)
        .in('menu_opcion_id', opcionIds)
        .not('producto_id', 'is', null);
      
      if (error) throw error;
      return (data || []) as ProductoCostoExtra[];
    },
    enabled: opciones.length > 0,
  });

  // Fetch categorías
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('orden');
      if (error) throw error;
      return data as Categoria[];
    },
  });

  // Fetch productos
  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('disponible', true)
        .order('nombre');
      if (error) throw error;
      return data as Producto[];
    },
  });

  // Agregar categoría al menú
  const addCategoriaMutation = useMutation({
    mutationFn: async (categoriaId: string) => {
      const categoria = categorias.find(c => c.id === categoriaId);
      if (!categoria) throw new Error('Categoría no encontrada');
      
      const orden = opciones.length;
      const { error } = await supabase
        .from('menu_opciones')
        .insert([{ 
          menu_id: menu.id, 
          nombre: categoria.nombre, 
          orden,
          categoria_id: categoriaId 
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      setSelectedCategoriaId('');
      toast.success('Categoría agregada al menú');
    },
    onError: (error) => toast.error(error.message),
  });

  // Eliminar categoría del menú
  const deleteOpcionMutation = useMutation({
    mutationFn: async (opcionId: string) => {
      await supabase.from('menu_opcion_items').delete().eq('menu_opcion_id', opcionId);
      const { error } = await supabase.from('menu_opciones').delete().eq('id', opcionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-opciones', menu.id] });
      queryClient.invalidateQueries({ queryKey: ['menu-productos-extra', menu.id] });
      toast.success('Categoría eliminada del menú');
    },
    onError: (error) => toast.error(error.message),
  });

  // Agregar costo extra a producto
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

  // Eliminar costo extra
  const deleteExtraCostMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('menu_opcion_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-productos-extra', menu.id] });
    },
    onError: (error) => toast.error(error.message),
  });

  // Categorías ya usadas en este menú
  const usedCategoriaIds = opciones.map(o => o.categoria_id).filter(Boolean);
  const availableCategorias = categorias.filter(c => !usedCategoriaIds.includes(c.id));

  const handleAddCategoria = () => {
    if (!selectedCategoriaId) {
      toast.error('Selecciona una categoría');
      return;
    }
    addCategoriaMutation.mutate(selectedCategoriaId);
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
      {/* Instrucciones */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-sm font-medium mb-2">📋 Configuración del Menú</p>
        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
          <li>Agrega las categorías que forman parte de este menú (Ej: Entradas, Fondos, Bebidas)</li>
          <li>Todos los productos de cada categoría estarán disponibles automáticamente</li>
          <li>Opcionalmente, marca productos específicos con costo adicional</li>
        </ol>
      </div>

      {/* Agregar categoría */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Agregar categoría al menú</p>
          <div className="flex gap-2">
            <Select value={selectedCategoriaId} onValueChange={setSelectedCategoriaId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategorias.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">
                    Todas las categorías ya están agregadas
                  </p>
                ) : (
                  availableCategorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAddCategoria} 
              disabled={!selectedCategoriaId || addCategoriaMutation.isPending}
            >
              {addCategoriaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Agregar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de categorías del menú */}
      {opciones.length === 0 ? (
        <div className="text-center py-8">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">
            Agrega categorías para configurar las opciones del menú
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Categorías del menú ({opciones.length})
          </p>
          
          {opciones.map((opcion, index) => {
            const productosDeCategoria = productos.filter(p => p.categoria_id === opcion.categoria_id);
            const extrasDeOpcion = productosConExtra.filter(e => e.menu_opcion_id === opcion.id);
            
            return (
              <CategoriaEnMenu
                key={opcion.id}
                opcion={opcion}
                index={index + 1}
                productosDeCategoria={productosDeCategoria}
                extrasDeOpcion={extrasDeOpcion}
                onDelete={() => {
                  if (confirm(`¿Eliminar "${opcion.nombre}" del menú?`)) {
                    deleteOpcionMutation.mutate(opcion.id);
                  }
                }}
                onAddExtra={(productoId, costo) => 
                  addExtraCostMutation.mutate({ opcionId: opcion.id, productoId, costo })
                }
                onDeleteExtra={(itemId) => deleteExtraCostMutation.mutate(itemId)}
                isDeleting={deleteOpcionMutation.isPending}
              />
            );
          })}
        </div>
      )}

      {/* Resumen del flujo */}
      {opciones.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">✅ Flujo del mesero al armar este menú:</p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((op, idx) => (
              <div key={op.id} className="flex items-center gap-1">
                <Badge variant="outline">{idx + 1}. {op.nombre}</Badge>
                {idx < opciones.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            El mesero seleccionará un producto de cada categoría para armar el combo.
          </p>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// Componente para cada categoría en el menú
interface CategoriaEnMenuProps {
  opcion: MenuOpcion;
  index: number;
  productosDeCategoria: Producto[];
  extrasDeOpcion: ProductoCostoExtra[];
  onDelete: () => void;
  onAddExtra: (productoId: string, costo: number) => void;
  onDeleteExtra: (itemId: string) => void;
  isDeleting: boolean;
}

function CategoriaEnMenu({ 
  opcion, 
  index,
  productosDeCategoria,
  extrasDeOpcion,
  onDelete, 
  onAddExtra,
  onDeleteExtra,
  isDeleting 
}: CategoriaEnMenuProps) {
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

  const productosConExtraIds = extrasDeOpcion.map(e => e.producto_id);
  const productosDisponiblesParaExtra = productosDeCategoria.filter(
    p => !productosConExtraIds.includes(p.id)
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 bg-secondary/30">
          <Badge className="h-6 w-6 p-0 flex items-center justify-center rounded-full">
            {index}
          </Badge>
          <div className="flex-1">
            <p className="font-medium">{opcion.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {productosDeCategoria.length} productos disponibles
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Productos */}
        <div className="p-3 space-y-3">
          {/* Lista de productos de la categoría */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Productos disponibles:
            </p>
            <div className="flex flex-wrap gap-1">
              {productosDeCategoria.slice(0, 8).map((prod) => {
                const extra = extrasDeOpcion.find(e => e.producto_id === prod.id);
                return (
                  <Badge 
                    key={prod.id} 
                    variant={extra ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {prod.nombre}
                    {extra && (
                      <span className="ml-1 opacity-75">+S/{Number(extra.costo_adicional).toFixed(0)}</span>
                    )}
                  </Badge>
                );
              })}
              {productosDeCategoria.length > 8 && (
                <Badge variant="secondary" className="text-xs">
                  +{productosDeCategoria.length - 8} más
                </Badge>
              )}
              {productosDeCategoria.length === 0 && (
                <span className="text-xs text-muted-foreground italic">
                  No hay productos en esta categoría
                </span>
              )}
            </div>
          </div>

          {/* Productos con costo extra */}
          {extrasDeOpcion.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium flex items-center gap-1 mb-2">
                <DollarSign className="h-3 w-3" />
                Productos con costo adicional:
              </p>
              <div className="space-y-1">
                {extrasDeOpcion.map((extra) => (
                  <div 
                    key={extra.id} 
                    className="flex items-center justify-between gap-2 p-2 bg-primary/5 rounded text-sm"
                  >
                    <span>{extra.producto?.nombre}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">+S/ {Number(extra.costo_adicional).toFixed(2)}</Badge>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => onDeleteExtra(extra.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agregar costo extra */}
          {!showAddExtra ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAddExtra(true)}
              disabled={productosDisponiblesParaExtra.length === 0}
              className="w-full text-xs"
            >
              <DollarSign className="h-3 w-3 mr-1" />
              Agregar producto con costo extra
            </Button>
          ) : (
            <div className="flex gap-2 items-end p-3 border rounded-lg bg-muted/30">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Producto</label>
                <Select value={selectedProductoId} onValueChange={setSelectedProductoId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productosDisponiblesParaExtra.map((prod) => (
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
                  className="h-9"
                  value={costoExtra}
                  onChange={(e) => setCostoExtra(parseFloat(e.target.value) || 0)}
                />
              </div>
              <Button size="sm" className="h-9" onClick={handleAddExtra}>
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9"
                onClick={() => {
                  setShowAddExtra(false);
                  setSelectedProductoId('');
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
