import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UtensilsCrossed, Plus, ShoppingCart, Minus, X, User, LogIn, UserPlus, Clock, CheckCircle, ChefHat, Package } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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

// Decodifica el código para obtener el número de mesa
const decodeMesaCode = (code: string): number | null => {
  // Función para generar código (debe coincidir con Mesas.tsx)
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
    // Primero intentar como número simple (compatibilidad hacia atrás)
    const simpleNumber = parseInt(code, 10);
    if (!isNaN(simpleNumber) && simpleNumber > 0 && simpleNumber <= 100) {
      return simpleNumber;
    }
    
    // Intentar decodificar código seguro
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
        
        // Check if order is still pending (not entregado or cancelado)
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
          // Clear stored order if delivered or cancelled
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
    
    // Subscribe to real-time updates
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
      // Logged in user - go to regular checkout with mesa info
      navigate('/checkout', { 
        state: { 
          items: cart, 
          mesa: numeroMesa 
        } 
      });
    } else {
      // Not logged in - show options dialog
      setShowAuthDialog(true);
    }
  };

  const handleGuestCheckout = () => {
    setShowAuthDialog(false);
    navigate('/checkout-invitado', { 
      state: { 
        items: cart, 
        mesa: numeroMesa 
      } 
    });
  };

  const productosWithoutCategoria = productos?.filter(p => !p.categoria_id) ?? [];

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
                ? 'Inicia sesión para ganar puntos y ver tu historial' 
                : 'Crea tu cuenta para acumular puntos con cada pedido'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Nombre completo</Label>
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
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : authMode === 'login' ? (
                <LogIn className="h-4 w-4 mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
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
          <div className="container py-4">
            <Card className="border-primary/30 bg-background">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const config = ESTADO_CONFIG[pendingOrder.estado] || ESTADO_CONFIG.pendiente;
                      const Icon = config.icon;
                      return (
                        <div className={`p-2 rounded-full ${config.bgColor}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                      );
                    })()}
                    <div>
                      <p className="font-semibold">Tu pedido está {ESTADO_CONFIG[pendingOrder.estado]?.label.toLowerCase() || 'en proceso'}</p>
                      <p className="text-sm text-muted-foreground">
                        {pendingOrder.orden_items?.length || 0} producto(s) • S/ {Number(pendingOrder.total).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${ESTADO_CONFIG[pendingOrder.estado]?.bgColor || 'bg-muted'} ${ESTADO_CONFIG[pendingOrder.estado]?.color || 'text-foreground'}`}>
                    {ESTADO_CONFIG[pendingOrder.estado]?.label || pendingOrder.estado}
                  </Badge>
                </div>
                
                {/* Order items preview */}
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                  {pendingOrder.orden_items?.slice(0, 3).map((item, idx) => (
                    <span key={item.id}>
                      {idx > 0 && ' • '}
                      {item.cantidad}x {item.productos?.nombre || 'Producto'}
                    </span>
                  ))}
                  {(pendingOrder.orden_items?.length || 0) > 3 && (
                    <span> y {pendingOrder.orden_items!.length - 3} más...</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

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
