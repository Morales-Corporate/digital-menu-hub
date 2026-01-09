import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CheckCircle, QrCode, Upload, Loader2, Banknote, CreditCard, User, Phone, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen_url?: string | null;
}

type OrderStatus = 'datos' | 'metodo' | 'pago' | 'confirmando' | 'confirmado';
type PaymentMethod = 'yape_plin' | 'efectivo' | 'tarjeta';

const guestSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es muy largo'),
  telefono: z.string().trim().optional().refine(val => !val || /^\d{9}$/.test(val), {
    message: 'El teléfono debe tener 9 dígitos'
  })
});

export default function CheckoutInvitado() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, mesa, mesaCodigo } = (location.state as { items: CartItem[]; mesa: number; mesaCodigo?: string }) || { items: [], mesa: 0, mesaCodigo: '' };
  
  const [status, setStatus] = useState<OrderStatus>('datos');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Guest info
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [errors, setErrors] = useState<{ nombre?: string; telefono?: string }>({});
  
  // Payment
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [montoPago, setMontoPago] = useState('');
  const [pagoExacto, setPagoExacto] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const vuelto = montoPago ? parseFloat(montoPago) - total : 0;

  useEffect(() => {
    if (paymentMethod === 'efectivo' && pagoExacto) {
      setMontoPago(total.toFixed(2));
    }
  }, [paymentMethod, pagoExacto, total]);

  // Redirect if no items
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-bold mb-2">No hay productos</h1>
            <p className="text-muted-foreground mb-4">
              Parece que no hay productos en tu pedido.
            </p>
            <Button onClick={() => navigate(mesaCodigo ? `/mesa/${mesaCodigo}` : '/')}>
              Volver al menú
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleProceedToPayment = () => {
    const result = guestSchema.safeParse({ nombre, telefono });
    if (!result.success) {
      const fieldErrors: { nombre?: string; telefono?: string } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'nombre') fieldErrors.nombre = err.message;
        if (err.path[0] === 'telefono') fieldErrors.telefono = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setStatus('metodo');
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setStatus('pago');

    if (method === 'efectivo') {
      setPagoExacto(true);
      setMontoPago(total.toFixed(2));
    } else {
      setMontoPago('');
    }
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
    if (paymentMethod === 'yape_plin' && !receiptFile) {
      toast.error('Por favor sube el comprobante de pago');
      return;
    }

    if (paymentMethod === 'efectivo') {
      const montoNumerico = pagoExacto ? total : parseFloat(montoPago);
      if (!pagoExacto && (!montoPago || isNaN(montoNumerico) || montoNumerico < total)) {
        toast.error('El monto debe ser igual o mayor al total');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let comprobantePath: string | null = null;

      // Upload receipt if yape_plin (for guest, we store in a general folder)
      if (paymentMethod === 'yape_plin' && receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `invitados/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('comprobantes-pago')
          .upload(fileName, receiptFile);

        if (uploadError) throw uploadError;
        comprobantePath = fileName;
      }

      // Buscar mesero asignado a esta mesa para hoy
      let meseroId: string | null = null;
      if (mesa) {
        const hoy = new Date().toISOString().split('T')[0];
        const { data: asignacion } = await supabase
          .from('asignacion_mesas')
          .select('mesero_id')
          .eq('fecha', hoy)
          .gte('mesa_fin', mesa)
          .lte('mesa_inicio', mesa)
          .maybeSingle();
        
        if (asignacion) {
          meseroId = asignacion.mesero_id;
        }
      }

      // Create guest order
      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert({
          user_id: null,
          total: total,
          estado: 'pendiente',
          metodo_pago: paymentMethod,
          puntos_ganados: 0, // Guests don't earn points
          comprobante_pago: comprobantePath,
          monto_pago: paymentMethod === 'efectivo' ? (pagoExacto ? total : parseFloat(montoPago)) : null,
          es_invitado: true,
          nombre_invitado: nombre,
          telefono_invitado: telefono || null,
          numero_mesa: mesa,
          mesero_id: meseroId
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

      // Save order to localStorage for tracking
      const guestOrderData = {
        orderId: order.id,
        mesa: mesa,
        nombre: nombre,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(`guest_order_${mesa}`, JSON.stringify(guestOrderData));

      setOrderId(order.id);
      setStatus('confirmado');
      toast.success('¡Tu pedido ha sido enviado!');

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error('Error al crear el pedido: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'yape_plin': return 'Yape/Plin';
      case 'efectivo': return 'Efectivo';
      case 'tarjeta': return 'Tarjeta (POS)';
    }
  };

  const getOrderNumber = (id: string) => id.slice(-6).toUpperCase();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        {status !== 'confirmado' && (
          <Button variant="ghost" onClick={() => {
            if (status === 'pago') setStatus('metodo');
            else if (status === 'metodo') setStatus('datos');
            else navigate(mesaCodigo ? `/mesa/${mesaCodigo}` : '/');
          }} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        )}

        {status === 'datos' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Tu Información
              </CardTitle>
              <CardDescription>Mesa {mesa} - Ingresa tus datos para el pedido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Summary */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-medium text-sm">Resumen del pedido:</p>
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span>S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span>S/ {total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Tu nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className={errors.nombre ? 'border-destructive' : ''}
                />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono (opcional)</Label>
                <Input
                  id="telefono"
                  type="tel"
                  placeholder="Ej: 987654321"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className={errors.telefono ? 'border-destructive' : ''}
                />
                {errors.telefono && (
                  <p className="text-sm text-destructive">{errors.telefono}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Para recibir notificaciones sobre tu pedido
                </p>
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
              <CardDescription>Mesa {mesa} - Selecciona cómo deseas pagar</CardDescription>
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
                  <p className="text-sm text-muted-foreground">Pago al mesero</p>
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
                  <p className="text-sm text-muted-foreground">El mesero trae el POS</p>
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
                disabled={!receiptFile || isSubmitting}
              >
                {isSubmitting ? (
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
              <CardDescription>El pago se realizará al mesero</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-500/10 p-4 rounded-lg">
                <p className="text-center text-lg font-bold">Total a pagar:</p>
                <p className="text-center text-2xl font-bold text-green-600">S/ {total.toFixed(2)}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pagoExacto"
                    checked={pagoExacto}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true;
                      setPagoExacto(isChecked);
                      setMontoPago(isChecked ? total.toFixed(2) : '');
                    }}
                  />
                  <Label htmlFor="pagoExacto">Pago exacto</Label>
                </div>

                {pagoExacto ? (
                  <div className="bg-muted p-3 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Pagas exacto:</p>
                    <p className="text-xl font-bold text-foreground">S/ {total.toFixed(2)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label htmlFor="montoPago">¿Con cuánto pagarás?</Label>
                    <Input
                      id="montoPago"
                      type="number"
                      placeholder={`Mínimo S/ ${total.toFixed(2)}`}
                      value={montoPago}
                      onChange={(e) => setMontoPago(e.target.value)}
                      min={total}
                      step="0.01"
                    />
                    {vuelto > 0 && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Tu vuelto será: <span className="font-semibold text-foreground">S/ {vuelto.toFixed(2)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleConfirmPayment}
                disabled={isSubmitting || (!pagoExacto && (!montoPago || parseFloat(montoPago) < total))}
              >
                {isSubmitting ? (
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
              <CardDescription>El mesero llevará el POS a tu mesa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-500/10 p-4 rounded-lg">
                <p className="text-center text-lg font-bold">Total a pagar:</p>
                <p className="text-center text-2xl font-bold text-blue-600">S/ {total.toFixed(2)}</p>
              </div>

              <div className="bg-muted p-4 rounded-lg text-center">
                <CreditCard className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Al confirmar, un mesero llevará el POS a tu mesa para procesar el pago.
                </p>
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleConfirmPayment}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
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

        {status === 'confirmado' && orderId && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-8 text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">¡Pedido Enviado!</h2>
              <p className="text-muted-foreground mb-4">
                Tu pedido ha sido recibido y está siendo preparado.
              </p>
              
              <div className="bg-white dark:bg-background p-4 rounded-lg mb-6">
                <p className="text-sm text-muted-foreground">Número de pedido:</p>
                <p className="text-2xl font-bold text-primary">#{getOrderNumber(orderId)}</p>
                <p className="text-sm text-muted-foreground mt-2">Mesa {mesa}</p>
              </div>

              <div className="bg-muted p-4 rounded-lg text-left space-y-2">
                <p className="font-medium">Detalles del pedido:</p>
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span>S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span>S/ {total.toFixed(2)}</span>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Método de pago: {getPaymentMethodLabel(paymentMethod!)}
                </p>
              </div>

              <Button 
                className="w-full mt-6" 
                variant="outline"
                onClick={() => navigate(`/mesa/${mesa}`)}
              >
                Hacer otro pedido
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
