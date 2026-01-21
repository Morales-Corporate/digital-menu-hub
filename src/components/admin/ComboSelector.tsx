import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, Check, UtensilsCrossed, 
  Loader2, Plus, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type Menu = Tables<'menus'>;
type Producto = Tables<'productos'>;
type Categoria = Tables<'categorias'>;

// Tipo manual para menu_opciones con categoria_id
interface MenuOpcionWithCategoriaId {
  id: string;
  menu_id: string;
  nombre: string;
  orden: number | null;
  cantidad: number | null;
  created_at: string | null;
  categoria_id: string | null;
  categoria?: Categoria | null;
}

// Productos con costo extra específico
interface ProductoCostoExtra {
  id: string;
  menu_opcion_id: string;
  producto_id: string | null;
  costo_adicional: number | null;
}

interface MenuWithOpciones extends Menu {
  opciones: MenuOpcionWithCategoriaId[];
}

// Selected product for a combo slot
interface ComboSelection {
  opcionId: string;
  opcionNombre: string;
  producto: Producto;
  costoAdicional: number;
}

export interface ComboCartItem {
  menuId: string;
  menuNombre: string;
  precioBase: number;
  selecciones: ComboSelection[];
  totalExtra: number;
  totalFinal: number;
}

interface ComboSelectorProps {
  onAddCombo: (combo: ComboCartItem) => void;
  onCancel: () => void;
}

export default function ComboSelector({ onAddCombo, onCancel }: ComboSelectorProps) {
  const [selectedMenu, setSelectedMenu] = useState<MenuWithOpciones | null>(null);
  const [selections, setSelections] = useState<Map<string, ComboSelection>>(new Map());
  const [currentOpcionIndex, setCurrentOpcionIndex] = useState(0);

  // Fetch active menus with options
  const { data: menus, isLoading } = useQuery({
    queryKey: ['menus-with-opciones'],
    queryFn: async () => {
      const { data: menusData, error: menusError } = await supabase
        .from('menus')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      
      if (menusError) throw menusError;
      
      // Fetch options for each menu with categoria
      const menusWithOpciones: MenuWithOpciones[] = await Promise.all(
        (menusData || []).map(async (menu) => {
          const { data: opciones, error: opcionesError } = await supabase
            .from('menu_opciones')
            .select(`
              *,
              categoria:categorias(*)
            `)
            .eq('menu_id', menu.id)
            .order('orden');
          
          if (opcionesError) throw opcionesError;
          
          return { 
            ...menu, 
            opciones: (opciones || []) as MenuOpcionWithCategoriaId[] 
          };
        })
      );
      
      // Filter out menus without options
      return menusWithOpciones.filter(m => m.opciones.length > 0);
    },
  });

  // Fetch all products for category-based options
  const { data: allProductos = [] } = useQuery({
    queryKey: ['productos-para-combo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('disponible', true)
        .order('nombre');
      if (error) throw error;
      return data as Producto[];
    },
    enabled: !!selectedMenu,
  });

  // Fetch extra costs for products in options
  const { data: productosCostoExtra = [] } = useQuery({
    queryKey: ['productos-costo-extra', selectedMenu?.id],
    queryFn: async () => {
      if (!selectedMenu) return [];
      const opcionIds = selectedMenu.opciones.map(o => o.id);
      
      const { data, error } = await supabase
        .from('menu_opcion_items')
        .select('*')
        .in('menu_opcion_id', opcionIds)
        .not('producto_id', 'is', null);
      
      if (error) throw error;
      return (data || []) as ProductoCostoExtra[];
    },
    enabled: !!selectedMenu,
  });

  // Get available products for current option
  const currentOpcion = selectedMenu?.opciones[currentOpcionIndex];
  
  const availableProducts = useMemo(() => {
    if (!currentOpcion || !currentOpcion.categoria_id) return [];
    
    // Get all products from the category
    const categoryProducts = allProductos.filter(
      p => p.categoria_id === currentOpcion.categoria_id
    );
    
    // Map products with their extra cost (if any)
    return categoryProducts.map(producto => {
      const extraCostItem = productosCostoExtra.find(
        e => e.menu_opcion_id === currentOpcion.id && e.producto_id === producto.id
      );
      return {
        producto,
        costoAdicional: Number(extraCostItem?.costo_adicional || 0)
      };
    });
  }, [currentOpcion, allProductos, productosCostoExtra]);

  const handleSelectProduct = (producto: Producto, costoAdicional: number) => {
    if (!currentOpcion) return;
    
    const newSelections = new Map(selections);
    newSelections.set(currentOpcion.id, {
      opcionId: currentOpcion.id,
      opcionNombre: currentOpcion.nombre,
      producto,
      costoAdicional
    });
    setSelections(newSelections);
    
    // Move to next option or stay
    if (selectedMenu && currentOpcionIndex < selectedMenu.opciones.length - 1) {
      setCurrentOpcionIndex(prev => prev + 1);
    }
  };

  const handleFinishCombo = () => {
    if (!selectedMenu) return;
    
    // Validate all options are selected
    const missingOptions = selectedMenu.opciones.filter(
      op => !selections.has(op.id)
    );
    
    if (missingOptions.length > 0) {
      toast.error(`Falta seleccionar: ${missingOptions.map(o => o.nombre).join(', ')}`);
      return;
    }
    
    const selectionsArray = Array.from(selections.values());
    const totalExtra = selectionsArray.reduce((sum, s) => sum + s.costoAdicional, 0);
    const totalFinal = Number(selectedMenu.precio) + totalExtra;
    
    onAddCombo({
      menuId: selectedMenu.id,
      menuNombre: selectedMenu.nombre,
      precioBase: Number(selectedMenu.precio),
      selecciones: selectionsArray,
      totalExtra,
      totalFinal
    });
  };

  const totalExtra = useMemo(() => {
    return Array.from(selections.values()).reduce((sum, s) => sum + s.costoAdicional, 0);
  }, [selections]);

  const isComplete = selectedMenu && selections.size === selectedMenu.opciones.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Step 1: Select Menu
  if (!selectedMenu) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h3 className="font-semibold">Seleccionar Menú/Combo</h3>
        </div>
        
        {menus?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay menús activos configurados</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {menus?.map((menu) => (
              <Card 
                key={menu.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSelectedMenu(menu);
                  setSelections(new Map());
                  setCurrentOpcionIndex(0);
                }}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {menu.imagen_url ? (
                    <img 
                      src={menu.imagen_url} 
                      alt={menu.nombre}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
                      <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{menu.nombre}</p>
                    {menu.descripcion && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {menu.descripcion}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {menu.opciones.map(op => (
                        <Badge key={op.id} variant="outline" className="text-xs">
                          {op.nombre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      S/ {Number(menu.precio).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Build Combo
  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setSelectedMenu(null);
              setSelections(new Map());
              setCurrentOpcionIndex(0);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-semibold">{selectedMenu.nombre}</h3>
            <p className="text-sm text-muted-foreground">
              Precio base: S/ {Number(selectedMenu.precio).toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Running total */}
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-bold text-primary">
            S/ {(Number(selectedMenu.precio) + totalExtra).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {selectedMenu.opciones.map((op, idx) => (
          <div 
            key={op.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              selections.has(op.id) 
                ? 'bg-primary' 
                : idx === currentOpcionIndex 
                  ? 'bg-primary/50' 
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Option tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {selectedMenu.opciones.map((op, idx) => {
          const isSelected = selections.has(op.id);
          const isCurrent = idx === currentOpcionIndex;
          return (
            <Button
              key={op.id}
              variant={isCurrent ? 'default' : isSelected ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setCurrentOpcionIndex(idx)}
              className="flex-shrink-0"
            >
              {isSelected && <Check className="h-3 w-3 mr-1" />}
              {op.nombre}
            </Button>
          );
        })}
      </div>

      {/* Current selection */}
      {currentOpcion && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {currentOpcion.nombre}
              {currentOpcion.categoria && (
                <Badge variant="outline" className="font-normal text-xs">
                  {currentOpcion.categoria.nombre}
                </Badge>
              )}
              {selections.has(currentOpcion.id) && (
                <Badge variant="secondary" className="font-normal">
                  <Check className="h-3 w-3 mr-1" />
                  {selections.get(currentOpcion.id)?.producto.nombre}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay productos disponibles en esta categoría
              </p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="grid grid-cols-2 gap-2">
                  {availableProducts.map(({ producto, costoAdicional }) => {
                    const isChosen = selections.get(currentOpcion.id)?.producto.id === producto.id;
                    return (
                      <button
                        key={producto.id}
                        onClick={() => handleSelectProduct(producto, costoAdicional)}
                        className={`relative flex flex-col items-center p-3 border rounded-lg transition-all text-left ${
                          isChosen 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        {producto.imagen_url ? (
                          <img 
                            src={producto.imagen_url} 
                            alt={producto.nombre}
                            className="w-12 h-12 rounded-lg object-cover mb-2"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-2">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs font-medium text-center line-clamp-2">
                          {producto.nombre}
                        </p>
                        {costoAdicional > 0 && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            +S/ {costoAdicional.toFixed(2)}
                          </Badge>
                        )}
                        {isChosen && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary of selections */}
      {selections.size > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Resumen del combo:</p>
            {Array.from(selections.values()).map((sel) => (
              <div key={sel.opcionId} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{sel.opcionNombre}:</span>
                <span>
                  {sel.producto.nombre}
                  {sel.costoAdicional > 0 && (
                    <span className="text-primary ml-1">+S/ {sel.costoAdicional.toFixed(2)}</span>
                  )}
                </span>
              </div>
            ))}
            {totalExtra > 0 && (
              <div className="flex justify-between text-sm font-medium pt-1 border-t">
                <span>Extras:</span>
                <span className="text-primary">+S/ {totalExtra.toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => {
            setSelectedMenu(null);
            setSelections(new Map());
          }}
        >
          Cancelar
        </Button>
        <Button 
          className="flex-1"
          disabled={!isComplete}
          onClick={handleFinishCombo}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar al Pedido
        </Button>
      </div>
    </div>
  );
}