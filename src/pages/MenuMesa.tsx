import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, UtensilsCrossed, Plus, ShoppingCart, Minus, X } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

type Producto = Tables<'productos'>;
type Categoria = Tables<'categorias'>;

interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen_url?: string | null;
}

export default function MenuMesa() {
  const { numero } = useParams<{ numero: string }>();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const numeroMesa = parseInt(numero || '0', 10);

  const { data: categorias, isLoading: loadingCategorias } = useQuery({
    queryKey: ['menu-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('orden', { ascending: true });
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const { data: productos, isLoading: loadingProductos } = useQuery({
    queryKey: ['menu-productos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('disponible', true)
        .or('stock.is.null,stock.gt.0')
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data as Producto[];
    },
  });

  const isLoading = loadingCategorias || loadingProductos;

  const getProductosByCategoria = (categoriaId: string) => {
    return productos?.filter(p => p.categoria_id === categoriaId) ?? [];
  };

  const addToCart = (producto: Producto) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === producto.id);
      if (existing) {
        return prev.map(i =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { 
        id: producto.id, 
        nombre: producto.nombre, 
        precio: Number(producto.precio), 
        cantidad: 1,
        imagen_url: producto.imagen_url
      }];
    });
    toast.success(`${producto.nombre} agregado`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.id === id) {
            const newQty = item.cantidad + delta;
            return newQty <= 0 ? null : { ...item, cantidad: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.cantidad, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Tu carrito está vacío');
      return;
    }
    // Navigate to guest checkout with cart and mesa info
    navigate('/checkout-invitado', { 
      state: { 
        items: cart, 
        mesa: numeroMesa 
      } 
    });
  };

  const productosWithoutCategoria = productos?.filter(p => !p.categoria_id) ?? [];

  if (!numero || isNaN(numeroMesa) || numeroMesa <= 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-bold mb-2">Mesa no válida</h1>
            <p className="text-muted-foreground">
              El código QR parece estar incorrecto. Por favor, solicita ayuda a un mesero.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-display text-lg font-semibold">Nuestro Menú</span>
              <Badge variant="secondary" className="ml-2">Mesa {numeroMesa}</Badge>
            </div>
          </div>
          
          {/* Cart Button */}
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Tu Pedido - Mesa {numeroMesa}</SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto mt-4">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Tu carrito está vacío
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        {item.imagen_url ? (
                          <img 
                            src={item.imagen_url} 
                            alt={item.nombre}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.nombre}</p>
                          <p className="text-sm text-muted-foreground">
                            S/ {item.precio.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center">{item.cantidad}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t pt-4 mt-4 space-y-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                  <Button className="w-full" size="lg" onClick={handleCheckout}>
                    Continuar con el pedido
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-8 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            ¡Bienvenido!
          </h1>
          <p className="text-muted-foreground">
            Estás en la mesa {numeroMesa}. Explora nuestro menú y haz tu pedido.
          </p>
        </div>
      </section>

      {/* Menu */}
      <main className="container py-8">
        {categorias?.map(categoria => {
          const categProductos = getProductosByCategoria(categoria.id);
          if (categProductos.length === 0) return null;
          
          return (
            <section key={categoria.id} className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{categoria.nombre}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categProductos.map(producto => (
                  <Card key={producto.id} className="overflow-hidden">
                    <div className="aspect-[4/3] relative">
                      {producto.imagen_url ? (
                        <img
                          src={producto.imagen_url}
                          alt={producto.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <UtensilsCrossed className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {producto.stock !== null && producto.stock <= 5 && (
                        <Badge className="absolute top-2 right-2 bg-orange-500">
                          Últimos {producto.stock}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{producto.nombre}</h3>
                        <span className="font-bold text-primary">
                          S/ {Number(producto.precio).toFixed(2)}
                        </span>
                      </div>
                      {producto.descripcion && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {producto.descripcion}
                        </p>
                      )}
                      <Button 
                        className="w-full" 
                        size="sm"
                        onClick={() => addToCart(producto)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Agregar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}

        {productosWithoutCategoria.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Otros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productosWithoutCategoria.map(producto => (
                <Card key={producto.id} className="overflow-hidden">
                  <div className="aspect-[4/3] relative">
                    {producto.imagen_url ? (
                      <img
                        src={producto.imagen_url}
                        alt={producto.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <UtensilsCrossed className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{producto.nombre}</h3>
                      <span className="font-bold text-primary">
                        S/ {Number(producto.precio).toFixed(2)}
                      </span>
                    </div>
                    {producto.descripcion && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {producto.descripcion}
                      </p>
                    )}
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => addToCart(producto)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating cart button for mobile */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-50">
          <Button 
            className="w-full shadow-lg" 
            size="lg"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver pedido ({itemCount}) - S/ {total.toFixed(2)}
          </Button>
        </div>
      )}
    </div>
  );
}
