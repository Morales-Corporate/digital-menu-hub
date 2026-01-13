import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, UtensilsCrossed, Plus, ShoppingCart, Minus, X, User, LogIn, UserPlus, Clock, CheckCircle, ChefHat, Package, Search, Star, ArrowUpDown, ChevronRight, Eye } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ProductDetailDialog } from '@/components/ProductDetailDialog';

type Producto = Tables<'productos'>;
type Categoria = Tables<'categorias'>;

interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen_url?: string | null;
}

type AuthMode = 'login' | 'register';
type SortOption = 'nombre' | 'precio-asc' | 'precio-desc';

// Decodifica el código para obtener el número de mesa
const decodeMesaCode = (code: string): number | null => {
  const generateMesaCode = (numeroMesa: number, secret: string = 'restaurante2024'): string => {
    const str = `${secret}-mesa-${numeroMesa}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const codeHash = Math.abs(hash).toString(36).substring(0, 6).padEnd(6, 'x');
    return `${codeHash}${numeroMesa.toString(36)}`;
  };

  try {
    if (!code || code.length < 7) return null;
    const mesaPart = code.substring(6);
    const numeroMesa = parseInt(mesaPart, 36);
    if (isNaN(numeroMesa) || numeroMesa <= 0) return null;
    const expectedCode = generateMesaCode(numeroMesa);
    if (expectedCode === code) {
      return numeroMesa;
    }
    return null;
  } catch {
    return null;
  }
};

interface GuestOrderData {
  orderId: string;
  mesa: number;
  nombre: string;
  createdAt: string;
}

interface PendingOrder {
  id: string;
  estado: string;
  total: number;
  created_at: string;
  nombre_invitado: string | null;
  orden_items: {
    id: string;
    cantidad: number;
    precio_unitario: number;
    productos: { nombre: string } | null;
  }[];
}

const ESTADO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-700', bgColor: 'bg-amber-100' },
  confirmado: { label: 'Confirmado', icon: CheckCircle, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  en_preparacion: { label: 'En Preparación', icon: ChefHat, color: 'text-orange-700', bgColor: 'bg-orange-100' },
  entregado: { label: 'Entregado', icon: Package, color: 'text-green-700', bgColor: 'bg-green-100' },
};

// Compact product card for horizontal scroll
function ProductCardCompact({ 
  producto, 
  onAdd, 
  onViewDetail,
  cartQty 
}: { 
  producto: Producto; 
  onAdd: () => void; 
  onViewDetail: () => void;
  cartQty: number;
}) {
  return (
    <div className="w-28 flex-shrink-0 snap-start">
      <Card className="overflow-hidden h-full flex flex-col">
        <div 
          className="relative cursor-pointer w-full"
          onClick={onViewDetail}
          style={{ paddingBottom: '100%' }}
        >
          <div className="absolute inset-0">
            {producto.imagen_url ? (
              <img
                src={producto.imagen_url}
                alt={producto.nombre}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          {producto.stock !== null && producto.stock <= 5 && (
            <Badge className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 bg-orange-500 z-10">
              {producto.stock}
            </Badge>
          )}
          {cartQty > 0 && (
            <Badge className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 bg-primary z-10">
              {cartQty}
            </Badge>
          )}
        </div>
        <CardContent className="p-2 flex-1 flex flex-col justify-between">
          <h3 
            className="font-medium text-xs line-clamp-2 mb-1 leading-tight cursor-pointer hover:text-primary"
            onClick={onViewDetail}
          >
            {producto.nombre}
          </h3>
          <div className="flex justify-between items-center gap-1">
            <span className="font-bold text-primary text-xs">
              S/ {Number(producto.precio).toFixed(2)}
            </span>
            <Button 
              size="icon"
              className="h-6 w-6 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MenuMesa() {
  const { numero: codigoMesa } = useParams<{ numero: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  
  // New state for enhanced navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('nombre');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  
  // Product detail dialog state
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  
  const numeroMesa = useMemo(() => {
    return decodeMesaCode(codigoMesa || '');
  }, [codigoMesa]);

  // Check for pending guest order and subscribe to updates
  useEffect(() => {
    if (!numeroMesa) return;
    
    const fetchPendingOrder = async () => {
      const storedOrder = localStorage.getItem(`guest_order_${numeroMesa}`);
      if (!storedOrder) return;
      
      try {
        const guestData: GuestOrderData = JSON.parse(storedOrder);
        
        const { data: order, error } = await supabase
          .from('ordenes')
          .select(`
            id, estado, total, created_at, nombre_invitado,
            orden_items (
              id, cantidad, precio_unitario,
              productos (nombre)
            )
          `)
          .eq('id', guestData.orderId)
          .single();
        
        if (error || !order) {
          localStorage.removeItem(`guest_order_${numeroMesa}`);
          return;
        }
        
        if (order.estado === 'entregado' || order.estado === 'cancelado') {
          localStorage.removeItem(`guest_order_${numeroMesa}`);
          setPendingOrder(null);
        } else {
          setPendingOrder(order as unknown as PendingOrder);
        }
      } catch {
        localStorage.removeItem(`guest_order_${numeroMesa}`);
      }
    };
    
    fetchPendingOrder();
    
    const storedOrder = localStorage.getItem(`guest_order_${numeroMesa}`);
    if (!storedOrder) return;
    
    let orderId: string;
    try {
      orderId = JSON.parse(storedOrder).orderId;
    } catch {
      return;
    }
    
    const channel = supabase
      .channel(`guest-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ordenes',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.estado === 'entregado' || updated.estado === 'cancelado') {
            localStorage.removeItem(`guest_order_${numeroMesa}`);
            setPendingOrder(null);
            if (updated.estado === 'entregado') {
              toast.success('¡Tu pedido ha sido entregado!');
            }
          } else {
            setPendingOrder(prev => prev ? { ...prev, estado: updated.estado } : null);
            const config = ESTADO_CONFIG[updated.estado];
            if (config) {
              toast.info(`Tu pedido está: ${config.label}`);
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [numeroMesa]);

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

  // Fetch popular products (most ordered)
  const { data: popularProductIds } = useQuery({
    queryKey: ['productos-populares'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orden_items')
        .select('producto_id, cantidad')
        .not('producto_id', 'is', null);
      
      if (error) throw error;
      
      // Aggregate quantities by product
      const productCounts: Record<string, number> = {};
      data?.forEach(item => {
        if (item.producto_id) {
          productCounts[item.producto_id] = (productCounts[item.producto_id] || 0) + item.cantidad;
        }
      });
      
      // Get top 10
      return Object.entries(productCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);
    },
  });

  const isLoading = loadingCategorias || loadingProductos;

  // Set initial active category
  useEffect(() => {
    if (categorias && categorias.length > 0 && !activeCategory) {
      setActiveCategory('destacados');
    }
  }, [categorias, activeCategory]);

  // Sort and filter products
  const sortProducts = (prods: Producto[]) => {
    const sorted = [...prods];
    switch (sortOption) {
      case 'nombre':
        return sorted.sort((a, b) => a.nombre.localeCompare(b.nombre));
      case 'precio-asc':
        return sorted.sort((a, b) => Number(a.precio) - Number(b.precio));
      case 'precio-desc':
        return sorted.sort((a, b) => Number(b.precio) - Number(a.precio));
      default:
        return sorted;
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productos) return [];
    let filtered = productos;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(query) ||
        p.descripcion?.toLowerCase().includes(query)
      );
    }
    
    return sortProducts(filtered);
  }, [productos, searchQuery, sortOption]);

  const getProductosByCategoria = (categoriaId: string) => {
    return sortProducts(filteredProducts.filter(p => p.categoria_id === categoriaId));
  };

  const popularProducts = useMemo(() => {
    if (!productos || !popularProductIds) return [];
    return popularProductIds
      .map(id => productos.find(p => p.id === id))
      .filter(Boolean) as Producto[];
  }, [productos, popularProductIds]);

  const getCartQuantity = (productId: string) => {
    return cart.find(i => i.id === productId)?.cantidad || 0;
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

  const openProductDetail = (producto: Producto) => {
    setSelectedProduct(producto);
    setShowProductDetail(true);
  };

  const handleUpdateQuantityFromDialog = (delta: number) => {
    if (selectedProduct) {
      updateQuantity(selectedProduct.id, delta);
    }
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

  const handleAuthSubmit = async () => {
    setAuthError('');
    setAuthSubmitting(true);
    
    try {
      if (authMode === 'login') {
        const { error } = await signIn(authEmail, authPassword);
        if (error) {
          setAuthError(error.message === 'Invalid login credentials' 
            ? 'Credenciales incorrectas' 
            : error.message);
          return;
        }
        toast.success('¡Sesión iniciada!');
        setShowAuthDialog(false);
      } else {
        const { error } = await signUp(authEmail, authPassword, authName);
        if (error) {
          if (error.message.includes('already registered')) {
            setAuthError('Este correo ya está registrado');
          } else {
            setAuthError(error.message);
          }
          return;
        }
        toast.success('¡Cuenta creada! Ya puedes hacer tu pedido.');
        setShowAuthDialog(false);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Tu carrito está vacío');
      return;
    }
    
    if (user) {
      navigate('/checkout', { 
        state: { 
          items: cart, 
          mesa: numeroMesa,
          mesaCodigo: codigoMesa
        } 
      });
    } else {
      setShowAuthDialog(true);
    }
  };

  const handleGuestCheckout = () => {
    setShowAuthDialog(false);
    navigate('/checkout-invitado', { 
      state: { 
        items: cart, 
        mesa: numeroMesa,
        mesaCodigo: codigoMesa
      } 
    });
  };

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = categoryRefs.current[categoryId];
    if (element) {
      const headerOffset = 180; // Account for sticky headers
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const productosWithoutCategoria = filteredProducts.filter(p => !p.categoria_id);

  if (!codigoMesa || numeroMesa === null || numeroMesa <= 0) {
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
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold hidden sm:inline">Menú</span>
              <Badge variant="secondary" className="text-xs">Mesa {numeroMesa}</Badge>
            </div>
          </div>
          
          {/* Cart Button */}
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Carrito</span>
                {itemCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {itemCount}
                  </Badge>
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
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        {item.imagen_url ? (
                          <img 
                            src={item.imagen_url} 
                            alt={item.nombre}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.nombre}</p>
                          <p className="text-sm text-muted-foreground">
                            S/ {item.precio.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center text-sm">{item.cantidad}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X className="h-3 w-3" />
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
                  {user ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground text-center">
                        Ordenando como <span className="font-medium text-foreground">{user.email}</span>
                      </p>
                      <Button className="w-full" size="lg" onClick={handleCheckout}>
                        Continuar con el pedido
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full" size="lg" onClick={handleCheckout}>
                      Continuar con el pedido
                    </Button>
                  )}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Search and Sort Bar */}
        <div className="container py-2 border-t bg-background">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar platos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[130px] h-9">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nombre">A-Z</SelectItem>
                <SelectItem value="precio-asc">Menor precio</SelectItem>
                <SelectItem value="precio-desc">Mayor precio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category Tabs */}
        <div 
          ref={tabsContainerRef}
          className="container overflow-x-auto scrollbar-hide border-t bg-background"
        >
          <div className="flex gap-1 py-2 min-w-max">
            <Button
              variant={activeCategory === 'destacados' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 rounded-full whitespace-nowrap"
              onClick={() => scrollToCategory('destacados')}
            >
              <Star className="h-3 w-3 mr-1" />
              Destacados
            </Button>
            {categorias?.map(cat => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 rounded-full whitespace-nowrap"
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.nombre}
              </Button>
            ))}
            {productosWithoutCategoria.length > 0 && (
              <Button
                variant={activeCategory === 'otros' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 rounded-full whitespace-nowrap"
                onClick={() => scrollToCategory('otros')}
              >
                Otros
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'login' 
                ? 'Inicia sesión para acumular puntos y recibir recompensas'
                : 'Crea tu cuenta para empezar a acumular puntos'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Nombre</Label>
                <Input
                  id="auth-name"
                  placeholder="Tu nombre"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="auth-email">Correo electrónico</Label>
              <Input
                id="auth-email"
                type="email"
                placeholder="tu@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="auth-password">Contraseña</Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>
            
            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}
            
            <Button 
              className="w-full" 
              onClick={handleAuthSubmit}
              disabled={authSubmitting}
            >
              {authSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : authMode === 'login' ? (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Iniciar Sesión
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Crear Cuenta
                </>
              )}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">o</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleGuestCheckout}
            >
              <User className="h-4 w-4 mr-2" />
              Continuar como invitado
            </Button>
            
            <p className="text-center text-sm text-muted-foreground">
              {authMode === 'login' ? (
                <>
                  ¿No tienes cuenta?{' '}
                  <button 
                    className="text-primary hover:underline"
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  >
                    Regístrate
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button 
                    className="text-primary hover:underline"
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  >
                    Inicia sesión
                  </button>
                </>
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Order Banner */}
      {pendingOrder && (
        <section className="bg-primary/10 border-b border-primary/20">
          <div className="container py-3">
            <Card className="border-primary/30 bg-background">
              <CardContent className="p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = ESTADO_CONFIG[pendingOrder.estado] || ESTADO_CONFIG.pendiente;
                      const Icon = config.icon;
                      return (
                        <div className={`p-1.5 rounded-full ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                      );
                    })()}
                    <div>
                      <p className="font-semibold text-sm">Pedido {ESTADO_CONFIG[pendingOrder.estado]?.label.toLowerCase() || 'en proceso'}</p>
                      <p className="text-xs text-muted-foreground">
                        {pendingOrder.orden_items?.length || 0} producto(s) • S/ {Number(pendingOrder.total).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${ESTADO_CONFIG[pendingOrder.estado]?.bgColor || 'bg-muted'} ${ESTADO_CONFIG[pendingOrder.estado]?.color || 'text-foreground'}`}>
                    {ESTADO_CONFIG[pendingOrder.estado]?.label || pendingOrder.estado}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Search results message */}
      {searchQuery && (
        <div className="container py-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            {filteredProducts.length} resultado(s) para "{searchQuery}"
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2 h-auto p-0 text-primary"
              onClick={() => setSearchQuery('')}
            >
              Limpiar
            </Button>
          </p>
        </div>
      )}

      {/* Menu Content */}
      <main className="container py-4 space-y-6">
        
        {/* Featured/Popular Section */}
        {popularProducts.length > 0 && !searchQuery && (
          <section ref={(el) => { categoryRefs.current['destacados'] = el; }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                Más Pedidos
              </h2>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-4 snap-x snap-mandatory">
                {popularProducts.map(producto => (
                  <ProductCardCompact 
                    key={producto.id} 
                    producto={producto} 
                    onAdd={() => addToCart(producto)}
                    onViewDetail={() => openProductDetail(producto)}
                    cartQty={getCartQuantity(producto.id)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        )}

        {/* Categories with horizontal scroll */}
        {categorias?.map(categoria => {
          const categProductos = getProductosByCategoria(categoria.id);
          if (categProductos.length === 0) return null;
          
          return (
            <section 
              key={categoria.id} 
              ref={(el) => { categoryRefs.current[categoria.id] = el; }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">{categoria.nombre}</h2>
                <span className="text-xs text-muted-foreground">{categProductos.length} platos</span>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-3 pb-4 snap-x snap-mandatory">
                  {categProductos.map(producto => (
                    <ProductCardCompact 
                      key={producto.id} 
                      producto={producto} 
                      onAdd={() => addToCart(producto)}
                      onViewDetail={() => openProductDetail(producto)}
                      cartQty={getCartQuantity(producto.id)}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          );
        })}

        {/* Products without category */}
        {productosWithoutCategoria.length > 0 && (
          <section ref={(el) => { categoryRefs.current['otros'] = el; }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Otros</h2>
              <span className="text-xs text-muted-foreground">{productosWithoutCategoria.length} platos</span>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-4 snap-x snap-mandatory">
                {productosWithoutCategoria.map(producto => (
                  <ProductCardCompact 
                    key={producto.id} 
                    producto={producto} 
                    onAdd={() => addToCart(producto)}
                    onViewDetail={() => openProductDetail(producto)}
                    cartQty={getCartQuantity(producto.id)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        )}

        {/* Empty state for search */}
        {searchQuery && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron platos</h3>
            <p className="text-muted-foreground mb-4">
              No hay resultados para "{searchQuery}"
            </p>
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Ver todo el menú
            </Button>
          </div>
        )}
      </main>

      {/* Floating cart button for mobile */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-50">
          <Button 
            className="w-full shadow-lg h-12" 
            size="lg"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Ver pedido ({itemCount}) - S/ {total.toFixed(2)}
          </Button>
        </div>
      )}

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        producto={selectedProduct}
        open={showProductDetail}
        onOpenChange={setShowProductDetail}
        onAddToCart={addToCart}
        cartQuantity={selectedProduct ? getCartQuantity(selectedProduct.id) : 0}
        onUpdateQuantity={handleUpdateQuantityFromDialog}
      />
    </div>
  );
}
