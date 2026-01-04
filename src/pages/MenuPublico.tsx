import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, UtensilsCrossed, LogIn, Plus, RefreshCw, Star, Gift, Cake, Clock, CheckCircle, Package } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { CartSheet } from '@/components/CartSheet';
import UserMenu from '@/components/UserMenu';
import { toast } from 'sonner';
import { differenceInDays, parseISO, setYear, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

type Producto = Tables<'productos'>;
type Categoria = Tables<'categorias'>;

interface ProductoConCategoria extends Producto {
  categoria: Categoria | null;
}

const ESTADOS_PENDIENTES = ['pendiente', 'confirmado', 'en_preparacion', 'en_camino'];
const ESTADO_ENTREGADO = 'entregado';

const getEstadoConfig = (estado: string) => {
  switch (estado) {
    case 'pendiente':
      return { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock };
    case 'confirmado':
      return { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle };
    case 'en_preparacion':
      return { label: 'En Preparación', color: 'bg-orange-500', icon: Package };
    case 'en_camino':
      return { label: 'En Camino', color: 'bg-purple-500', icon: Package };
    case 'entregado':
      return { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle };
    default:
      return { label: estado, color: 'bg-muted', icon: Clock };
  }
};

export default function MenuPublico() {
  const { user } = useAuth();
  const { addItem, addItems } = useCart();

  // Obtener perfil del usuario para el saludo y cumpleaños
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, fecha_nacimiento')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Obtener puntos del usuario
  const { data: puntosData } = useQuery({
    queryKey: ['user-points', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('puntos_usuario')
        .select('puntos_totales')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Obtener todas las órdenes del usuario
  const { data: ordenes } = useQuery({
    queryKey: ['user-all-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          total,
          estado,
          created_at,
          puntos_ganados,
          orden_items (
            cantidad,
            precio_unitario,
            productos (id, nombre, precio, imagen_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Separar órdenes pendientes y entregadas
  const ordenesPendientes = ordenes?.filter((o: any) => 
    ESTADOS_PENDIENTES.includes(o.estado)
  ) || [];
  
  const ordenesEntregadas = ordenes?.filter((o: any) => 
    o.estado === ESTADO_ENTREGADO
  ) || [];

  const ultimaOrdenEntregada = ordenesEntregadas[0];

  // Obtener última orden para repetir (cualquier estado)
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
  const puntos = puntosData?.puntos_totales || 0;
  
  // Calcular días para el cumpleaños
  const getDaysUntilBirthday = () => {
    if (!profile?.fecha_nacimiento) return null;
    const today = new Date();
    const birthday = parseISO(profile.fecha_nacimiento);
    const thisYearBirthday = setYear(birthday, today.getFullYear());
    
    let daysUntil = differenceInDays(thisYearBirthday, today);
    if (daysUntil < 0) {
      // El cumpleaños ya pasó este año, calcular para el próximo año
      const nextYearBirthday = setYear(birthday, today.getFullYear() + 1);
      daysUntil = differenceInDays(nextYearBirthday, today);
    }
    return daysUntil;
  };

  const daysUntilBirthday = getDaysUntilBirthday();
  
  // Calcular puntos para próximo nivel/descuento
  const getPointsInfo = () => {
    if (puntos >= 500) return { level: 'Oro', next: null, remaining: 0 };
    if (puntos >= 200) return { level: 'Plata', next: 'Oro', remaining: 500 - puntos };
    if (puntos >= 50) return { level: 'Bronce', next: 'Plata', remaining: 200 - puntos };
    return { level: 'Nuevo', next: 'Bronce', remaining: 50 - puntos };
  };
  
  const pointsInfo = getPointsInfo();

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

  const renderOrdenPendiente = (orden: any) => {
    const estadoConfig = getEstadoConfig(orden.estado);
    const IconComponent = estadoConfig.icon;

    return (
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/30 border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Badge className={`${estadoConfig.color} text-white flex items-center gap-1`}>
              <IconComponent className="h-3 w-3" />
              {estadoConfig.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(orden.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {orden.orden_items.slice(0, 5).map((item: any, index: number) => (
              <div 
                key={index} 
                className="flex-shrink-0 w-24 text-center"
              >
                {item.productos?.imagen_url ? (
                  <img 
                    src={item.productos.imagen_url} 
                    alt={item.productos?.nombre}
                    className="w-20 h-20 object-cover rounded-lg mx-auto mb-1"
                  />
                ) : (
                  <div className="w-20 h-20 bg-muted rounded-lg mx-auto mb-1 flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <p className="text-xs font-medium truncate">{item.productos?.nombre}</p>
                <p className="text-xs text-muted-foreground">x{item.cantidad}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold">S/ {Number(orden.total).toFixed(2)}</span>
              <span className="text-xs text-primary ml-2">+{orden.puntos_ganados} pts</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
            {user && puntos > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 cursor-pointer">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {puntos} pts
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nivel {pointsInfo.level}</p>
                    {pointsInfo.next && (
                      <p className="text-xs">Faltan {pointsInfo.remaining} pts para {pointsInfo.next}</p>
                    )}
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
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
            {firstName 
              ? 'Descubre nuestra selección de platos preparados con ingredientes frescos y recetas tradicionales.'
              : 'Descubre nuestra selección de platos preparados con ingredientes frescos y recetas tradicionales.'
            }
          </p>
          
          {/* Badges informativos para usuarios logueados */}
          {user && (
            <div className="flex flex-wrap justify-center gap-3">
              {daysUntilBirthday !== null && daysUntilBirthday <= 30 && (
                <Badge variant="outline" className="gap-2 py-2 px-4 bg-pink-50 border-pink-200 text-pink-700">
                  <Cake className="h-4 w-4" />
                  {daysUntilBirthday === 0 
                    ? '¡Feliz cumpleaños! 🎉 Descuento especial hoy'
                    : `Faltan ${daysUntilBirthday} días para tu cumpleaños`
                  }
                </Badge>
              )}
              {pointsInfo.next && (
                <Badge variant="outline" className="gap-2 py-2 px-4 bg-amber-50 border-amber-200 text-amber-700">
                  <Gift className="h-4 w-4" />
                  Faltan {pointsInfo.remaining} pts para nivel {pointsInfo.next}
                </Badge>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Órdenes Pendientes (Carrusel) o Última Orden Entregada */}
      {user && (ordenesPendientes.length > 0 || ultimaOrdenEntregada) && (
        <section className="container py-6">
          {ordenesPendientes.length > 0 ? (
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                {ordenesPendientes.length === 1 ? 'Tu pedido en curso' : 'Tus pedidos en curso'}
              </h3>
              {ordenesPendientes.length === 1 ? (
                renderOrdenPendiente(ordenesPendientes[0])
              ) : (
                <Carousel className="w-full">
                  <CarouselContent>
                    {ordenesPendientes.map((orden: any) => (
                      <CarouselItem key={orden.id}>
                        {renderOrdenPendiente(orden)}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="flex justify-center gap-2 mt-4">
                    <CarouselPrevious className="static translate-y-0" />
                    <CarouselNext className="static translate-y-0" />
                  </div>
                </Carousel>
              )}
            </div>
          ) : ultimaOrdenEntregada ? (
            <Card className="bg-gradient-to-r from-primary/5 to-secondary/30 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    Tu último pedido entregado
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(ultimaOrdenEntregada.created_at!), "d 'de' MMMM", { locale: es })}
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {ultimaOrdenEntregada.orden_items.slice(0, 5).map((item: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex-shrink-0 w-24 text-center"
                    >
                      {item.productos?.imagen_url ? (
                        <img 
                          src={item.productos.imagen_url} 
                          alt={item.productos?.nombre}
                          className="w-20 h-20 object-cover rounded-lg mx-auto mb-1"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded-lg mx-auto mb-1 flex items-center justify-center">
                          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs font-medium truncate">{item.productos?.nombre}</p>
                      <p className="text-xs text-muted-foreground">x{item.cantidad}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold">S/ {ultimaOrdenEntregada.total.toFixed(2)}</span>
                    <span className="text-xs text-primary ml-2">+{ultimaOrdenEntregada.puntos_ganados} pts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      )}

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
