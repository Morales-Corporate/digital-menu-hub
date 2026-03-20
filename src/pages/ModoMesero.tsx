import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UtensilsCrossed, LogOut, ArrowLeft, Plus, Minus, Search,
  Send, Trash2, AlertTriangle, CheckCircle, Loader2, ShoppingCart,
  StickyNote
} from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

type Step = 'mesas' | 'productos' | 'resumen';

export default function ModoMesero() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('mesas');
  const [selectedMesa, setSelectedMesa] = useState<number | null>(null);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [existingItems, setExistingItems] = useState<CartItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [nota, setNota] = useState('');
  const [showNota, setShowNota] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [submitting, setSubmitting] = useState(false);

  // Check if caja is open
  const { data: cajaAbierta, isLoading: loadingCaja } = useQuery({
    queryKey: ['caja-abierta-mesero'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aperturas_caja')
        .select('id, fecha_apertura')
        .eq('estado', 'abierta')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Get mesero record linked to current user
  const { data: meseroRecord } = useQuery({
    queryKey: ['mi-mesero', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meseros')
        .select('id, nombre')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get total mesas from config (use Mesas page default of 10)
  const totalMesas = 20;

  // Fetch active orders filtered by current caja session
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['ordenes-activas-mesero', cajaAbierta?.id],
    queryFn: async () => {
      let query = supabase
        .from('ordenes')
        .select('id, numero_mesa, estado, total, created_at')
        .in('estado', ['pendiente', 'confirmado', 'en_preparacion'])
        .not('numero_mesa', 'is', null)
        .order('created_at', { ascending: false });

      if (cajaAbierta) {
        const { data: cajaData } = await supabase
          .from('aperturas_caja')
          .select('fecha_apertura')
          .eq('id', cajaAbierta.id)
          .single();
        if (cajaData?.fecha_apertura) {
          query = query.gte('created_at', cajaData.fecha_apertura);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
    enabled: !!cajaAbierta,
  });

  // Fetch productos
  const { data: productos = [] } = useQuery({
    queryKey: ['productos-mesero'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, nombre, precio, imagen_url, categoria_id, stock, is_combo_item, disponible')
        .eq('disponible', true)
        .or('is_combo_item.is.null,is_combo_item.eq.false')
        .or('stock.is.null,stock.gt.0')
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  // Fetch categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-mesero'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre, parent_id, orden')
        .order('orden');
      if (error) throw error;
      return data;
    },
  });

  // Only top-level categories that have products
  const topCategories = useMemo(() => {
    const catIdsWithProducts = new Set(productos.map(p => p.categoria_id).filter(Boolean));
    // Include parent categories
    const parentIds = new Set<string>();
    for (const cat of categorias) {
      if (catIdsWithProducts.has(cat.id) && cat.parent_id) {
        parentIds.add(cat.parent_id);
      }
    }
    return categorias.filter(c => !c.parent_id && (catIdsWithProducts.has(c.id) || parentIds.has(c.id)));
  }, [categorias, productos]);

  // Get subcategory IDs for a parent
  const getSubcategoryIds = (parentId: string) => {
    return categorias.filter(c => c.parent_id === parentId).map(c => c.id);
  };

  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const matchesSearch = !searchTerm || p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      if (selectedCategoria === 'todas') return matchesSearch;
      const subIds = getSubcategoryIds(selectedCategoria);
      const matchesCat = p.categoria_id === selectedCategoria || subIds.includes(p.categoria_id || '');
      return matchesSearch && matchesCat;
    });
  }, [productos, searchTerm, selectedCategoria, categorias]);

  // When mesa is selected, check for existing order
  const handleSelectMesa = async (mesa: number) => {
    setSelectedMesa(mesa);
    const existingOrder = activeOrders.find(o => o.numero_mesa === mesa);

    if (existingOrder) {
      // Load existing order items
      const { data: items } = await supabase
        .from('orden_items')
        .select('id, producto_id, cantidad, precio_unitario, productos(nombre)')
        .eq('orden_id', existingOrder.id);

      const mapped: CartItem[] = (items || []).map(i => ({
        id: i.id,
        producto_id: i.producto_id || '',
        nombre: (i.productos as any)?.nombre || 'Producto',
        precio: i.precio_unitario,
        cantidad: i.cantidad,
      }));

      setExistingOrderId(existingOrder.id);
      setExistingItems(mapped);
      setCart([]);
    } else {
      setExistingOrderId(null);
      setExistingItems([]);
      setCart([]);
    }
    setStep('productos');
  };

  const addToCart = (producto: typeof productos[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.producto_id === producto.id);
      if (existing) {
        return prev.map(i =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, {
        id: `new-${producto.id}`,
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1
      }];
    });
  };

  const updateCartQty = (productoId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => i.producto_id === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter(i => i.cantidad > 0)
    );
  };

  const removeFromCart = (productoId: string) => {
    setCart(prev => prev.filter(i => i.producto_id !== productoId));
  };

  const newTotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const existingTotal = existingItems.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const grandTotal = newTotal + existingTotal;

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto nuevo');
      return;
    }
    setSubmitting(true);
    try {
      let orderId = existingOrderId;

      if (!orderId) {
        // Create new order
        const { data: order, error } = await supabase
          .from('ordenes')
          .insert({
            user_id: null,
            total: newTotal,
            estado: 'pendiente',
            metodo_pago: 'pago_pendiente',
            puntos_ganados: 0,
            numero_mesa: selectedMesa,
            es_invitado: true,
            nombre_invitado: `Mesa ${selectedMesa}`,
            mesero_id: meseroRecord?.id || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        orderId = order.id;
      } else {
        // Update total on existing order
        const { error } = await supabase
          .from('ordenes')
          .update({ total: grandTotal })
          .eq('id', orderId);
        if (error) throw error;
      }

      // Insert new items
      const newItems = cart.map(i => ({
        orden_id: orderId!,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
      }));

      const { error: itemsError } = await supabase
        .from('orden_items')
        .insert(newItems);
      if (itemsError) throw itemsError;

      toast.success(existingOrderId ? 'Productos agregados al pedido' : 'Pedido enviado a cocina');
      queryClient.invalidateQueries({ queryKey: ['ordenes-activas-mesero'] });
      // Reset and go back to mesas
      setCart([]);
      setExistingItems([]);
      setExistingOrderId(null);
      setSelectedMesa(null);
      setNota('');
      setShowNota(false);
      setSearchTerm('');
      setSelectedCategoria('todas');
      setStep('mesas');
    } catch (error: any) {
      console.error(error);
      toast.error('Error al enviar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loadingCaja) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cajaAbierta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-6">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h1 className="text-2xl font-bold text-center">Caja cerrada</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Debes abrir caja antes de registrar pedidos. Contacta al administrador.
        </p>
        <Button variant="outline" onClick={handleSignOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
      </div>
    );
  }

  // STEP: MESAS
  if (step === 'mesas') {
    const mesasOcupadas = new Set(activeOrders.map(o => o.numero_mesa));
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="h-6 w-6 text-sidebar-primary" />
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground leading-tight">Modo Mesero</h1>
              {meseroRecord && (
                <p className="text-xs text-sidebar-foreground/70">{meseroRecord.nombre}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 p-4">
          <h2 className="text-xl font-bold mb-4">Selecciona una mesa</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {Array.from({ length: totalMesas }, (_, i) => i + 1).map(mesa => {
              const occupied = mesasOcupadas.has(mesa);
              return (
                <button
                  key={mesa}
                  onClick={() => handleSelectMesa(mesa)}
                  className={`
                    relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all
                    active:scale-95 min-h-[80px] font-bold text-lg
                    ${occupied
                      ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700'
                      : 'border-border bg-card text-card-foreground hover:border-primary hover:shadow-md'
                    }
                  `}
                >
                  <span className="text-2xl">{mesa}</span>
                  <span className="text-[10px] uppercase tracking-wider mt-1 opacity-70">
                    {occupied ? 'Ocupada' : 'Libre'}
                  </span>
                  {occupied && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-background" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // STEP: PRODUCTOS
  if (step === 'productos') {
    const cartCount = cart.reduce((s, i) => s + i.cantidad, 0);

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setStep('mesas'); setCart([]); setExistingItems([]); }} className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground leading-tight">Mesa {selectedMesa}</h1>
              {existingOrderId && (
                <p className="text-[11px] text-sidebar-foreground/70">Pedido existente · Agregando más</p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setStep('resumen')}
            disabled={cart.length === 0}
            className="gap-1.5 relative"
          >
            <ShoppingCart className="h-4 w-4" />
            Revisar
            {cartCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {cartCount}
              </Badge>
            )}
          </Button>
        </header>

        {/* Existing items banner */}
        {existingItems.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              📋 {existingItems.length} producto(s) ya en el pedido · S/ {existingTotal.toFixed(2)}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </div>

        {/* Category tabs - horizontal scroll */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategoria('todas')}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategoria === 'todas'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Todos
            </button>
            {topCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoria(cat.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCategoria === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {filteredProducts.map(producto => {
              const inCart = cart.find(i => i.producto_id === producto.id);
              const qty = inCart?.cantidad || 0;
              return (
                <button
                  key={producto.id}
                  onClick={() => addToCart(producto)}
                  className="relative flex flex-col items-center p-3 rounded-xl border bg-card hover:shadow-md transition-all active:scale-[0.97] text-center"
                >
                  {producto.imagen_url ? (
                    <img
                      src={producto.imagen_url}
                      alt={producto.nombre}
                      className="w-14 h-14 rounded-xl object-cover mb-2"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-2">
                      <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs font-medium line-clamp-2 leading-tight">{producto.nombre}</p>
                  <p className="text-sm font-bold text-primary mt-1">S/ {producto.precio.toFixed(2)}</p>
                  {qty > 0 && (
                    <Badge className="absolute -top-1.5 -right-1.5 h-6 w-6 p-0 flex items-center justify-center text-xs">
                      {qty}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No se encontraron productos</p>
            </div>
          )}
        </div>

        {/* Floating cart summary */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4 safe-area-pb">
            <Button className="w-full h-12 text-base gap-2" onClick={() => setStep('resumen')}>
              <ShoppingCart className="h-5 w-5" />
              Ver pedido ({cart.reduce((s, i) => s + i.cantidad, 0)}) · S/ {newTotal.toFixed(2)}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // STEP: RESUMEN
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setStep('productos')} className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold text-sidebar-foreground">Mesa {selectedMesa} · Resumen</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {/* Existing items (read-only) */}
        {existingItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ya en el pedido</h3>
            <div className="space-y-2">
              {existingItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-sm">{item.nombre}</p>
                    <p className="text-xs text-muted-foreground">x{item.cantidad} · S/ {(item.precio * item.cantidad).toFixed(2)}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">Enviado</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New items (editable) */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {existingItems.length > 0 ? 'Nuevos productos' : 'Tu pedido'}
          </h3>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.producto_id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">S/ {item.precio.toFixed(2)} c/u</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateCartQty(item.producto_id, -1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-6 text-center font-bold text-sm">{item.cantidad}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateCartQty(item.producto_id, 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeFromCart(item.producto_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="mb-4">
          {!showNota ? (
            <button
              onClick={() => setShowNota(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <StickyNote className="h-4 w-4" />
              Agregar nota (sin ají, bien cocido, etc.)
            </button>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <StickyNote className="h-4 w-4" /> Nota del pedido
              </label>
              <Textarea
                placeholder="Ej: sin ají, bien cocido..."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="rounded-lg border bg-card p-4 space-y-2">
          {existingItems.length > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pedido existente</span>
                <span>S/ {existingTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Nuevos productos</span>
                <span>S/ {newTotal.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2" />
            </>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>S/ {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4 safe-area-pb">
        <Button
          className="w-full h-14 text-lg gap-2 font-bold"
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {existingOrderId ? 'Agregar al pedido' : 'Enviar a cocina'}
        </Button>
      </div>
    </div>
  );
}
