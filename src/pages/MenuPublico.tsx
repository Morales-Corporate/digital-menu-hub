import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, UtensilsCrossed, LogIn, Plus, RefreshCw, User } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { CartSheet } from '@/components/CartSheet';
import UserMenu from '@/components/UserMenu';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Producto = Tables<'productos'>;
type Categoria = Tables<'categorias'>;

interface ProductoConCategoria extends Producto {
  categoria: Categoria | null;
}

export default function MenuPublico() {
  const { user } = useAuth();
  const { addItem, addItems } = useCart();

  // Obtener perfil del usuario para el saludo
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Obtener última orden para repetir
  const { data: ultimaOrden } = useQuery({
    queryKey: ['last-order', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          total,
          orden_items (
            cantidad,
            precio_unitario,
            productos (id, nombre, precio, imagen_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleRepeatOrder = () => {
    if (!ultimaOrden?.orden_items) return;
    
    const itemsToAdd = ultimaOrden.orden_items
      .filter((item: any) => item.productos)
      .map((item: any) => ({
        id: item.productos.id,
        nombre: item.productos.nombre,
        precio: Number(item.productos.precio),
        imagen_url: item.productos.imagen_url,
        quantity: item.cantidad
      }));

    if (itemsToAdd.length > 0) {
      addItems(itemsToAdd);
      toast.success('Productos de tu última orden agregados al carrito');
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || null;

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
        .order('nombre', { ascending: true });
      if (error) throw error;
      return data as Producto[];
    },
  });

  const isLoading = loadingCategorias || loadingProductos;

  const getProductosByCategoria = (categoriaId: string) => {
    return productos?.filter(p => p.categoria_id === categoriaId) ?? [];
  };
  const handleAddToCart = (producto: Producto) => {
    addItem({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      imagen_url: producto.imagen_url
    });
    toast.success(`${producto.nombre} agregado al carrito`);
  };

  const productosWithoutCategoria = productos?.filter(p => !p.categoria_id) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold">Nuestro Menú</span>
          </div>
          <div className="flex items-center gap-2">
            {user && ultimaOrden && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleRepeatOrder}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Repetir
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Repetir mi última orden</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {user && <CartSheet />}
            {user ? (
              <UserMenu />
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">
                  <LogIn className="h-4 w-4 mr-2" />
                  Ingresar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-16 md:py-24 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container text-center">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {firstName ? (
              <>¡Hola, {firstName}!</>
            ) : (
              <>Bienvenido a Nuestro Menú</>
            )}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {firstName 
              ? 'Descubre nuestra selección de platos preparados con ingredientes frescos y recetas tradicionales.'
              : 'Descubre nuestra selección de platos preparados con ingredientes frescos y recetas tradicionales.'
            }
          </p>
        </div>
      </section>

      {/* Menu Content */}
      <main className="container py-12">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : categorias?.length === 0 && productos?.length === 0 ? (
          <div className="text-center py-16">
            <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-display text-2xl mb-2">Menú en construcción</h2>
            <p className="text-muted-foreground">
              Pronto tendremos deliciosos platos para ti.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {categorias?.map((categoria, index) => {
              const categoryProducts = getProductosByCategoria(categoria.id);
              if (categoryProducts.length === 0) return null;
              
              return (
                <section 
                  key={categoria.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <h2 className="font-display text-2xl md:text-3xl font-semibold mb-6 pb-2 border-b">
                    {categoria.nombre}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryProducts.map((producto) => (
                      <ProductCard 
                        key={producto.id} 
                        producto={producto} 
                        onAddToCart={() => handleAddToCart(producto)}
                        showAddButton={!!user}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {productosWithoutCategoria.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="font-display text-2xl md:text-3xl font-semibold mb-6 pb-2 border-b">
                  Otros
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {productosWithoutCategoria.map((producto) => (
                    <ProductCard 
                      key={producto.id} 
                      producto={producto}
                      onAddToCart={() => handleAddToCart(producto)}
                      showAddButton={!!user}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Menú Digital. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

interface ProductCardProps {
  producto: Producto;
  onAddToCart?: () => void;
  showAddButton?: boolean;
}

function ProductCard({ producto, onAddToCart, showAddButton }: ProductCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {producto.imagen_url && (
        <div className="aspect-video">
          <img 
            src={producto.imagen_url} 
            alt={producto.nombre}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className={producto.imagen_url ? "p-4" : "p-6"}>
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-display text-lg font-medium">{producto.nombre}</h3>
          <span className="font-semibold text-primary text-lg whitespace-nowrap">
            S/ {Number(producto.precio).toFixed(2)}
          </span>
        </div>
        {producto.descripcion && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {producto.descripcion}
          </p>
        )}
        {showAddButton && (
          <Button 
            onClick={onAddToCart} 
            size="sm" 
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" /> Agregar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}