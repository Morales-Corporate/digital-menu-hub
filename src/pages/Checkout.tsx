import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Clock, QrCode, Upload, Loader2, Banknote, CreditCard, Gift, Percent } from 'lucide-react';
import { toast } from 'sonner';

type OrderStatus = 'resumen' | 'metodo' | 'pago' | 'confirmando' | 'confirmado';
type PaymentMethod = 'yape_plin' | 'efectivo' | 'tarjeta';

export default function Checkout() {
  const { items, total: subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus>('resumen');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [montoPago, setMontoPago] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obtener descuento activo del usuario
  const { data: descuentoActivo } = useQuery({
    queryKey: ['descuento-activo-checkout', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('descuentos_activos')
        .select('*, recompensas(*)')
        .eq('user_id', user.id)
        .eq('usado', false)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calcular descuento y total final
  const descuentoPorcentaje = descuentoActivo?.recompensas?.porcentaje_descuento || 0;
  const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
  const total = subtotal - descuentoMonto;

  const vuelto = montoPago ? parseFloat(montoPago) - total : 0;

  // Check if user profile is complete before allowing checkout
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setIsCheckingProfile(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, telefono, direccion, dni, fecha_nacimiento')
        .eq('id', user.id)
        .single();

      if (!profile?.full_name || !profile?.telefono || !profile?.direccion || !profile?.dni) {
        toast.error('Por favor completa tu perfil antes de realizar un pedido');
        navigate('/completar-perfil');
        return;
      }

      setIsCheckingProfile(false);
    };

    checkProfile();
  }, [user, navigate]);

  // Listen for order confirmation in real-time
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel('order-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ordenes',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          if (payload.new.estado === 'confirmado') {
            setStatus('confirmado');
            toast.success('¡Tu pedido ha sido confirmado!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const handleProceedToPayment = () => {
    setStatus('metodo');
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setStatus('pago');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    setReceiptFile(file);
    const preview = URL.createObjectURL(file);
    setReceiptPreview(preview);
  };

  const handleConfirmPayment = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para realizar un pedido');
      return;
    }

    if (paymentMethod === 'yape_plin' && !receiptFile) {
      toast.error('Por favor sube el comprobante de pago');
      return;
    }

    if (paymentMethod === 'efectivo') {
      const montoNumerico = parseFloat(montoPago);
      if (!montoPago || isNaN(montoNumerico) || montoNumerico < total) {
        toast.error('El monto debe ser igual o mayor al total');
        return;
      }
    }

    setIsUploading(true);

    try {
      let comprobantePath: string | null = null;

      // Upload receipt only for yape_plin
      if (paymentMethod === 'yape_plin' && receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('comprobantes-pago')
          .upload(fileName, receiptFile);

        if (uploadError) throw uploadError;
        comprobantePath = fileName;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert({
          user_id: user.id,
          total: total,
          estado: 'pendiente',
          metodo_pago: paymentMethod,
          puntos_ganados: Math.floor(total),
          comprobante_pago: comprobantePath,
          monto_pago: paymentMethod === 'efectivo' ? parseFloat(montoPago) : null
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        orden_id: order.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio
      }));

      const { error: itemsError } = await supabase
        .from('orden_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Marcar descuento como usado si existe
      if (descuentoActivo) {
        const { error: updateDescuentoError } = await supabase
          .from('descuentos_activos')
          .update({ 
            usado: true, 
            orden_id: order.id,
            usado_at: new Date().toISOString()
          })
          .eq('id', descuentoActivo.id);
        
        if (updateDescuentoError) {
          console.error('Error updating discount:', updateDescuentoError);
        }
        
        // Invalidar cache del descuento
        queryClient.invalidateQueries({ queryKey: ['descuento-activo'] });
      }

      setOrderId(order.id);
      setStatus('confirmando');
      clearCart();
      toast.info('Pedido enviado. Esperando confirmación del restaurante...');

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error('Error al crear el pedido: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFinish = () => {
    clearCart();
    navigate('/mi-cuenta');
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'yape_plin': return 'Yape/Plin';
      case 'efectivo': return 'Efectivo';
      case 'tarjeta': return 'Tarjeta (POS)';
    }
  };

  if (isCheckingProfile) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0 && status === 'resumen') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto pt-8 text-center">
          <p className="text-muted-foreground mb-4">Tu carrito está vacío</p>
          <Button onClick={() => navigate('/menu')}>Ver Menú</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        {status !== 'confirmado' && (
          <Button variant="ghost" onClick={() => {
            if (status === 'pago') setStatus('metodo');
            else if (status === 'metodo') setStatus('resumen');
            else navigate(-1);
          }} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        )}

        {status === 'resumen' && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">{item.nombre}</p>
                    <p className="text-sm text-muted-foreground">x{item.cantidad}</p>
                  </div>
                  <p className="font-medium">S/ {(item.precio * item.cantidad).toFixed(2)}</p>
                </div>
              ))}
              
              {/* Subtotal */}
              <div className="flex justify-between pt-2">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>S/ {subtotal.toFixed(2)}</span>
              </div>
              
              {/* Descuento activo */}
              {descuentoActivo && (
                <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Percent className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {descuentoActivo.recompensas?.nombre} ({descuentoPorcentaje}% OFF)
                    </span>
                  </div>
                  <span className="text-green-600 font-semibold">-S/ {descuentoMonto.toFixed(2)}</span>
                </div>
              )}
              
              {/* Total */}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>S/ {total.toFixed(2)}</span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Ganarás <span className="font-semibold text-primary">{Math.floor(total)} puntos</span> con este pedido
              </div>
              <Button className="w-full" size="lg" onClick={handleProceedToPayment}>
                Continuar al Pago
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'metodo' && (
          <Card>
            <CardHeader>
              <CardTitle>Método de Pago</CardTitle>
              <CardDescription>Selecciona cómo deseas pagar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-20 flex items-center justify-start gap-4 text-left"
                onClick={() => handleSelectPaymentMethod('yape_plin')}
              >
                <div className="bg-primary/10 p-3 rounded-full">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Yape / Plin</p>
                  <p className="text-sm text-muted-foreground">Pago con código QR</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="w-full h-20 flex items-center justify-start gap-4 text-left"
                onClick={() => handleSelectPaymentMethod('efectivo')}
              >
                <div className="bg-green-500/10 p-3 rounded-full">
                  <Banknote className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">Efectivo</p>
                  <p className="text-sm text-muted-foreground">Pago contra entrega</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="w-full h-20 flex items-center justify-start gap-4 text-left"
                onClick={() => handleSelectPaymentMethod('tarjeta')}
              >
                <div className="bg-blue-500/10 p-3 rounded-full">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">Tarjeta (POS)</p>
                  <p className="text-sm text-muted-foreground">El repartidor lleva el POS</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'pago' && paymentMethod === 'yape_plin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" /> Pago con Yape/Plin
              </CardTitle>
              <CardDescription>Escanea el código QR para realizar el pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                  <div className="text-center text-muted-foreground">
                    <QrCode className="h-16 w-16 mx-auto mb-2" />
                    <p className="text-xs">Código QR del negocio</p>
                  </div>
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Escanea con tu app de Yape o Plin
                </p>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="text-center text-lg font-bold">Monto a pagar:</p>
                <p className="text-center text-2xl font-bold text-primary">S/ {total.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-center">Sube tu comprobante de pago</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                
                {receiptPreview ? (
                  <div className="relative">
                    <img 
                      src={receiptPreview} 
                      alt="Comprobante" 
                      className="w-full max-h-48 object-contain rounded-lg border"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2"
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-24 border-dashed flex flex-col gap-2"
                  >
                    <Upload className="h-6 w-6" />
                    <span>Subir imagen del comprobante</span>
                  </Button>
                )}
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleConfirmPayment}
                disabled={!receiptFile || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando pedido...
                  </>
                ) : (
                  'Confirmar y enviar pedido'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'pago' && paymentMethod === 'efectivo' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" /> Pago en Efectivo
              </CardTitle>
              <CardDescription>El pago se realizará al momento de la entrega</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-500/10 p-4 rounded-lg">
                <p className="text-center text-lg font-bold">Total a pagar:</p>
                <p className="text-center text-2xl font-bold text-green-600">S/ {total.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="montoPago">¿Con cuánto pagarás?</Label>
                <Input
                  id="montoPago"
                  type="number"
                  placeholder="Ej: 50.00"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  min={total}
                  step="0.01"
                />
                {montoPago && parseFloat(montoPago) >= total && (
                  <div className="bg-muted p-3 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Tu vuelto será:</p>
                    <p className="text-xl font-bold text-primary">S/ {vuelto.toFixed(2)}</p>
                  </div>
                )}
                {montoPago && parseFloat(montoPago) < total && (
                  <p className="text-sm text-destructive">El monto debe ser igual o mayor al total</p>
                )}
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleConfirmPayment}
                disabled={!montoPago || parseFloat(montoPago) < total || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando pedido...
                  </>
                ) : (
                  'Confirmar pedido'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'pago' && paymentMethod === 'tarjeta' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" /> Pago con Tarjeta
              </CardTitle>
              <CardDescription>El repartidor llevará el POS para tu pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-500/10 p-4 rounded-lg">
                <p className="text-center text-lg font-bold">Total a pagar:</p>
                <p className="text-center text-2xl font-bold text-blue-600">S/ {total.toFixed(2)}</p>
              </div>

              <div className="bg-muted p-4 rounded-lg text-center">
                <CreditCard className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Al momento de la entrega, el repartidor tendrá un POS disponible para que puedas pagar con tu tarjeta de débito o crédito.
                </p>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleConfirmPayment}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando pedido...
                  </>
                ) : (
                  'Confirmar pedido'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'confirmando' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 animate-pulse text-amber-500" /> Esperando Confirmación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="py-8">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-amber-600 animate-pulse" />
                </div>
                <p className="text-lg font-medium">Tu pedido está siendo verificado</p>
                <p className="text-muted-foreground mt-2">
                  El restaurante confirmará tu pedido en breve
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Número de orden: <span className="font-mono">{orderId?.slice(0, 8)}</span>
              </div>
              <div className="text-sm">
                Método de pago: <span className="font-semibold">{paymentMethod && getPaymentMethodLabel(paymentMethod)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'confirmado' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" /> ¡Pedido Confirmado!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-lg font-medium">Tu pedido ha sido confirmado</p>
                <p className="text-muted-foreground mt-2">
                  Gracias por tu compra. ¡Disfruta tu comida!
                </p>
              </div>
              <Button className="w-full" onClick={handleFinish}>
                Ver Mis Pedidos
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}