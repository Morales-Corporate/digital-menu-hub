import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Minus, Search, ShoppingCart, Trash2, UtensilsCrossed, 
  User, Users, Hash, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import ComboSelector, { ComboCartItem } from './ComboSelector';
import ProductosPorCategoria from './ProductosPorCategoria';

interface ProductCartItem {
  type: 'product';
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen_url?: string | null;
}

interface ComboInCart {
  type: 'combo';
  id: string;
  combo: ComboCartItem;
}

type CartEntry = ProductCartItem | ComboInCart;

interface CrearPedidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: () => void;
  meseros: { id: string; nombre: string }[];
}

export default function CrearPedidoModal({ 
  open, 
  onOpenChange, 
  onOrderCreated,
  meseros 
}: CrearPedidoModalProps) {
  const [step, setStep] = useState<'mesa' | 'productos' | 'confirmar'>('mesa');
  const [productTab, setProductTab] = useState<'productos' | 'combos'>('productos');
  const [showComboSelector, setShowComboSelector] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState<string>('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [meseroId, setMeseroId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');

  // Fetch productos (excluding combo items for main product list)
  const { data: productos = [] } = useQuery({
    queryKey: ['productos-disponibles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, nombre, precio, imagen_url, categoria_id, stock, is_combo_item')
        .eq('disponible', true)
        .or('stock.is.null,stock.gt.0')
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Filter out combo items for the main product list
  const regularProducts = useMemo(() => {
    return productos.filter(p => !p.is_combo_item);
  }, [productos]);

  // Fetch categorías with parent_id for hierarchy
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-jerarquicas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre, parent_id, orden')
        .order('orden');
      if (error) throw error;
      return data as { id: string; nombre: string; parent_id: string | null; orden: number | null }[];
    },
    enabled: open
  });

  const filteredProducts = useMemo(() => {
    return regularProducts.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = selectedCategoria === 'todas' || p.categoria_id === selectedCategoria;
      return matchesSearch && matchesCategoria;
    });
  }, [regularProducts, searchTerm, selectedCategoria]);

  const addToCart = (producto: typeof productos[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.type === 'product' && item.id === producto.id);
      if (existing && existing.type === 'product') {
        return prev.map(item => 
          item.type === 'product' && item.id === producto.id 
            ? { ...item, cantidad: item.cantidad + 1 } 
            : item
        );
      }
      return [...prev, { 
        type: 'product' as const,
        id: producto.id, 
        nombre: producto.nombre, 
        precio: producto.precio,
        imagen_url: producto.imagen_url,
        cantidad: 1 
      }];
    });
  };

  const addComboToCart = (combo: ComboCartItem) => {
    const comboId = `combo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCart(prev => [...prev, { type: 'combo' as const, id: comboId, combo }]);
    setShowComboSelector(false);
    toast.success(`${combo.menuNombre} agregado al pedido`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.type === 'product' && item.id === id) {
            return { ...item, cantidad: item.cantidad + delta };
          }
          return item;
        })
        .filter(item => item.type === 'combo' || (item.type === 'product' && item.cantidad > 0));
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Calculate totals
  const { total, itemCount } = useMemo(() => {
    let t = 0;
    let c = 0;
    for (const item of cart) {
      if (item.type === 'product') {
        t += item.precio * item.cantidad;
        c += item.cantidad;
      } else {
        t += item.combo.totalFinal;
        c += 1;
      }
    }
    return { total: t, itemCount: c };
  }, [cart]);

  const resetForm = () => {
    setStep('mesa');
    setNumeroMesa('');
    setNombreCliente('');
    setMeseroId('');
    setSearchTerm('');
    setCart([]);
    setSelectedCategoria('todas');
    setProductTab('productos');
    setShowComboSelector(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    setSubmitting(true);
    try {
      // Create order with pago_pendiente
      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert({
          user_id: null,
          total: total,
          estado: 'pendiente',
          metodo_pago: 'pago_pendiente',
          puntos_ganados: 0,
          numero_mesa: parseInt(numeroMesa),
          es_invitado: true,
          nombre_invitado: nombreCliente || `Mesa ${numeroMesa}`,
          mesero_id: meseroId || null
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items - flatten combos into individual products
      const orderItems: { orden_id: string; producto_id: string; cantidad: number; precio_unitario: number }[] = [];
      
      for (const entry of cart) {
        if (entry.type === 'product') {
          orderItems.push({
            orden_id: order.id,
            producto_id: entry.id,
            cantidad: entry.cantidad,
            precio_unitario: entry.precio
          });
        } else {
          // For combos, add each selected product
          // Distribute the combo price proportionally or use base price + extras
          const combo = entry.combo;
          for (const sel of combo.selecciones) {
            // Calculate price for this item: base share + extra
            const baseShare = combo.precioBase / combo.selecciones.length;
            const itemPrice = baseShare + sel.costoAdicional;
            orderItems.push({
              orden_id: order.id,
              producto_id: sel.producto.id,
              cantidad: 1,
              precio_unitario: itemPrice
            });
          }
        }
      }

      const { error: itemsError } = await supabase
        .from('orden_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success('Pedido creado exitosamente');
      handleClose();
      onOrderCreated();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error('Error al crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  // If showing combo selector, render that instead
  if (step === 'productos' && showComboSelector) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Armar Combo
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <ComboSelector 
              onAddCombo={addComboToCart}
              onCancel={() => setShowComboSelector(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Nuevo Pedido - Mesero
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-2">
          <Badge variant={step === 'mesa' ? 'default' : 'secondary'} className="text-xs">
            1. Mesa
          </Badge>
          <div className="flex-1 h-px bg-border" />
          <Badge variant={step === 'productos' ? 'default' : 'secondary'} className="text-xs">
            2. Productos
          </Badge>
          <div className="flex-1 h-px bg-border" />
          <Badge variant={step === 'confirmar' ? 'default' : 'secondary'} className="text-xs">
            3. Confirmar
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Mesa */}
          {step === 'mesa' && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="mesa" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Número de Mesa *
                </Label>
                <Input
                  id="mesa"
                  type="number"
                  placeholder="Ej: 5"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Nombre del Cliente (opcional)
                </Label>
                <Input
                  id="cliente"
                  placeholder="Ej: Juan Pérez"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Mesero Asignado
                </Label>
                <Select value={meseroId} onValueChange={setMeseroId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mesero" />
                  </SelectTrigger>
                  <SelectContent>
                    {meseros.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                💡 El pago se registrará cuando se entregue el pedido al cliente.
              </p>
            </div>
          )}

          {/* Step 2: Productos */}
          {step === 'productos' && (
            <div className="space-y-4 px-1">
              {/* Tabs for Products vs Combos */}
              <Tabs value={productTab} onValueChange={(v) => setProductTab(v as 'productos' | 'combos')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="productos">
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Productos
                  </TabsTrigger>
                  <TabsTrigger value="combos">
                    <Package className="h-4 w-4 mr-2" />
                    Combos/Menús
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="productos" className="space-y-4 mt-4">
                  {/* Search filter */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Products organized by category hierarchy */}
                  {searchTerm ? (
                    // Show flat filtered results when searching
                    <ScrollArea className="h-[280px]">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {filteredProducts.map(producto => {
                          const inCart = cart.find(item => item.type === 'product' && item.id === producto.id);
                          const cantidad = inCart?.type === 'product' ? inCart.cantidad : 0;
                          return (
                            <button
                              key={producto.id}
                              onClick={() => addToCart(producto)}
                              className="relative flex flex-col items-center p-3 border rounded-lg hover:bg-secondary/50 transition-colors text-left"
                            >
                              {producto.imagen_url ? (
                                <img 
                                  src={producto.imagen_url} 
                                  alt={producto.nombre}
                                  className="w-10 h-10 rounded-lg object-cover mb-2"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-2">
                                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <p className="text-xs font-medium text-center line-clamp-2">{producto.nombre}</p>
                              <p className="text-xs text-primary font-bold">S/ {producto.precio.toFixed(2)}</p>
                              
                              {cantidad > 0 && (
                                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                                  {cantidad}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    // Show hierarchical view when not searching (excluding combo items)
                    <ProductosPorCategoria
                      productos={regularProducts}
                      categorias={categorias}
                      cart={cart.filter(c => c.type === 'product').map(c => ({ type: 'product' as const, id: c.id, cantidad: (c as ProductCartItem).cantidad }))}
                      onAddProduct={addToCart}
                    />
                  )}
                </TabsContent>

                <TabsContent value="combos" className="mt-4">
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Arma combos con precio especial (entrada + plato + bebida)
                    </p>
                    <Button onClick={() => setShowComboSelector(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Armar Combo
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Mini cart */}
              {cart.length > 0 && (
                <div className="border rounded-lg p-3 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <ShoppingCart className="h-4 w-4" /> Carrito ({itemCount})
                    </span>
                    <span className="font-bold">S/ {total.toFixed(2)}</span>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          {item.type === 'product' ? (
                            <>
                              <span className="truncate flex-1">{item.nombre}</span>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5"
                                  onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-4 text-center">{item.cantidad}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5"
                                  onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 text-destructive"
                                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex-1">
                                <span className="font-medium">{item.combo.menuNombre}</span>
                                <Badge variant="outline" className="ml-2 text-[10px]">Combo</Badge>
                                <p className="text-muted-foreground text-[10px]">
                                  {item.combo.selecciones.map(s => s.producto.nombre).join(' + ')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">S/ {item.combo.totalFinal.toFixed(2)}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 text-destructive"
                                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirmar */}
          {step === 'confirmar' && (
            <div className="space-y-4 px-1">
              <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mesa:</span>
                  <span className="font-medium">{numeroMesa}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{nombreCliente || `Mesa ${numeroMesa}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mesero:</span>
                  <span className="font-medium">
                    {meseros.find(m => m.id === meseroId)?.nombre || 'Sin asignar'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pago:</span>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                    Pendiente al entregar
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Pedido ({itemCount} items)</p>
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="text-sm">
                      {item.type === 'product' ? (
                        <div className="flex justify-between">
                          <span>{item.nombre} x{item.cantidad}</span>
                          <span className="font-medium">S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="bg-secondary/30 p-2 rounded">
                          <div className="flex justify-between font-medium">
                            <span>{item.combo.menuNombre}</span>
                            <span>S/ {item.combo.totalFinal.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.combo.selecciones.map((sel, idx) => (
                              <span key={sel.opcionId}>
                                {sel.opcionNombre}: {sel.producto.nombre}
                                {sel.costoAdicional > 0 && ` (+S/${sel.costoAdicional.toFixed(2)})`}
                                {idx < item.combo.selecciones.length - 1 && ' • '}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">S/ {total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          {step !== 'mesa' && (
            <Button 
              variant="outline" 
              onClick={() => setStep(step === 'confirmar' ? 'productos' : 'mesa')}
            >
              Atrás
            </Button>
          )}
          
          {step === 'mesa' && (
            <Button 
              onClick={() => setStep('productos')}
              disabled={!numeroMesa}
            >
              Siguiente
            </Button>
          )}
          
          {step === 'productos' && (
            <Button 
              onClick={() => setStep('confirmar')}
              disabled={cart.length === 0}
            >
              Revisar Pedido ({itemCount})
            </Button>
          )}
          
          {step === 'confirmar' && (
            <Button 
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Creando...' : 'Crear Pedido'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
