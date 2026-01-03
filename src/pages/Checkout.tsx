import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, Clock, QrCode, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type OrderStatus = 'resumen' | 'pago' | 'confirmando' | 'confirmado';

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus>('resumen');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (!receiptFile) {
      toast.error('Por favor sube el comprobante de pago');
      return;
    }

    setIsUploading(true);

    try {
      // Upload receipt first
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('comprobantes-pago')
        .upload(fileName, receiptFile);

      if (uploadError) throw uploadError;

      // Create order with receipt reference
      const { data: order, error: orderError } = await supabase
        .from('ordenes')
        .insert({
          user_id: user.id,
          total: total,
          estado: 'pendiente',
          metodo_pago: 'yape_plin',
          puntos_ganados: Math.floor(total),
          comprobante_pago: fileName
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

      setOrderId(order.id);
      setStatus('confirmando');
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
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
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
              <div className="flex justify-between text-lg font-bold pt-4">
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

        {status === 'pago' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" /> Pago con Yape/Plin
              </CardTitle>
              <CardDescription>Escanea el código QR para realizar el pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                {/* Placeholder QR - In production, replace with actual QR image */}
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

              {/* Receipt upload section */}
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
                  El restaurante confirmará tu pago en breve
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Número de orden: <span className="font-mono">{orderId?.slice(0, 8)}</span>
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
