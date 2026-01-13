import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Plus, Minus, Leaf, AlertTriangle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Separator } from '@/components/ui/separator';

type Producto = Tables<'productos'>;

interface ProductDetailDialogProps {
  producto: Producto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (producto: Producto) => void;
  cartQuantity?: number;
  onUpdateQuantity?: (delta: number) => void;
}

// Common allergen icons/labels mapping
const ALLERGEN_LABELS: Record<string, { label: string; color: string }> = {
  gluten: { label: 'Gluten', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  lacteos: { label: 'Lácteos', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  huevos: { label: 'Huevos', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  mariscos: { label: 'Mariscos', color: 'bg-red-100 text-red-800 border-red-300' },
  pescado: { label: 'Pescado', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  soja: { label: 'Soja', color: 'bg-green-100 text-green-800 border-green-300' },
  frutos_secos: { label: 'Frutos Secos', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  mani: { label: 'Maní', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  apio: { label: 'Apio', color: 'bg-lime-100 text-lime-800 border-lime-300' },
  mostaza: { label: 'Mostaza', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  sesamo: { label: 'Sésamo', color: 'bg-stone-100 text-stone-800 border-stone-300' },
  sulfitos: { label: 'Sulfitos', color: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export function ProductDetailDialog({
  producto,
  open,
  onOpenChange,
  onAddToCart,
  cartQuantity = 0,
  onUpdateQuantity,
}: ProductDetailDialogProps) {
  if (!producto) return null;

  const hasIngredients = producto.ingredientes && producto.ingredientes.trim().length > 0;
  const hasAllergens = producto.alergenos && producto.alergenos.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Product Image - centered with proper aspect ratio */}
        <div className="w-full bg-muted flex-shrink-0 flex items-center justify-center" style={{ maxHeight: '40vh' }}>
          {producto.imagen_url ? (
            <img
              src={producto.imagen_url}
              alt={producto.nombre}
              className="w-full h-auto max-h-[40vh] object-contain"
            />
          ) : (
            <div className="aspect-video w-full flex items-center justify-center">
              <UtensilsCrossed className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <DialogHeader className="text-left p-0">
            <div className="flex justify-between items-start gap-3">
              <DialogTitle className="text-xl font-display">{producto.nombre}</DialogTitle>
              <span className="text-xl font-bold text-primary whitespace-nowrap">
                S/ {Number(producto.precio).toFixed(2)}
              </span>
            </div>
          </DialogHeader>

          {/* Stock Badge */}
          {producto.stock !== null && producto.stock <= 5 && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              ¡Solo quedan {producto.stock}!
            </Badge>
          )}

          {/* Full Description */}
          {producto.descripcion ? (
            <p className="text-muted-foreground leading-relaxed">
              {producto.descripcion}
            </p>
          ) : (
            <p className="text-muted-foreground italic">
              Sin descripción disponible
            </p>
          )}

          {/* Ingredients Section */}
          {hasIngredients && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Leaf className="h-4 w-4 text-green-600" />
                  <span>Ingredientes</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                  {producto.ingredientes}
                </p>
              </div>
            </>
          )}

          {/* Allergens Section */}
          {hasAllergens && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Alérgenos</span>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {producto.alergenos?.map((alergeno) => {
                    const config = ALLERGEN_LABELS[alergeno.toLowerCase()];
                    return (
                      <Badge
                        key={alergeno}
                        variant="outline"
                        className={config?.color || 'bg-muted text-muted-foreground'}
                      >
                        {config?.label || alergeno}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {cartQuantity > 0 && onUpdateQuantity ? (
              <div className="flex items-center gap-2 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onUpdateQuantity(-1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold w-8 text-center">{cartQuantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onUpdateQuantity(1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  className="flex-1 ml-2"
                  onClick={() => onOpenChange(false)}
                >
                  Listo
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  onAddToCart(producto);
                  onOpenChange(false);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar al pedido
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
