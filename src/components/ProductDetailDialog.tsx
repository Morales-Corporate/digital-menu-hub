import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Plus, Minus } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Producto = Tables<'productos'>;

interface ProductDetailDialogProps {
  producto: Producto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (producto: Producto) => void;
  cartQuantity?: number;
  onUpdateQuantity?: (delta: number) => void;
}

export function ProductDetailDialog({
  producto,
  open,
  onOpenChange,
  onAddToCart,
  cartQuantity = 0,
  onUpdateQuantity,
}: ProductDetailDialogProps) {
  if (!producto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Product Image */}
        {producto.imagen_url ? (
          <div className="aspect-video w-full">
            <img
              src={producto.imagen_url}
              alt={producto.nombre}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-muted flex items-center justify-center">
            <UtensilsCrossed className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        <div className="p-6 space-y-4">
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
