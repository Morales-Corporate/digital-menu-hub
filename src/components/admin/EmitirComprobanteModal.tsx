import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileText, Printer, Download, Loader2, Receipt, Building2 } from 'lucide-react';
import TicketComprobante from './TicketComprobante';
import { useReactToPrint } from 'react-to-print';

interface OrdenItem {
  producto_id: string | null;
  cantidad: number;
  precio_unitario: number;
  productos?: {
    nombre: string;
  } | null;
}

interface Orden {
  id: string;
  total: number;
  numero_mesa: number | null;
  metodo_pago: string | null;
  nombre_invitado: string | null;
  created_at: string;
}

interface EmitirComprobanteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orden: Orden | null;
}

export default function EmitirComprobanteModal({
  open,
  onOpenChange,
  orden
}: EmitirComprobanteModalProps) {
  const queryClient = useQueryClient();
  const ticketRef = useRef<HTMLDivElement>(null);
  
  const [tipoComprobante, setTipoComprobante] = useState<'boleta' | 'factura'>('boleta');
  const [formato, setFormato] = useState<'ticket' | 'a5'>('ticket');
  const [showPreview, setShowPreview] = useState(false);
  
  // Client data for boleta
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDni, setClienteDni] = useState('');
  
  // Client data for factura
  const [clienteRazonSocial, setClienteRazonSocial] = useState('');
  const [clienteRuc, setClienteRuc] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');

  // Fetch empresa config
  const { data: empresaConfig } = useQuery({
    queryKey: ['configuracion-empresa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracion_empresa')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Fetch order items
  const { data: orderItems = [] } = useQuery({
    queryKey: ['orden-items-comprobante', orden?.id],
    queryFn: async () => {
      if (!orden) return [];
      const { data, error } = await supabase
        .from('orden_items')
        .select('producto_id, cantidad, precio_unitario, productos(nombre)')
        .eq('orden_id', orden.id);
      if (error) throw error;
      return data as OrdenItem[];
    },
    enabled: open && !!orden
  });

  // Mutation to create comprobante
  const createComprobante = useMutation({
    mutationFn: async () => {
      if (!orden || !empresaConfig) throw new Error('Datos incompletos');

      const serie = tipoComprobante === 'boleta' ? empresaConfig.serie_boleta : empresaConfig.serie_factura;
      const numero = tipoComprobante === 'boleta' ? empresaConfig.numero_boleta : empresaConfig.numero_factura;
      
      const subtotal = orden.total / 1.18;
      const igv = orden.total - subtotal;

      // Insert comprobante
      const { error: insertError } = await supabase
        .from('comprobantes')
        .insert({
          orden_id: orden.id,
          tipo: tipoComprobante,
          serie: serie,
          numero: numero,
          cliente_nombre: tipoComprobante === 'boleta' ? clienteNombre : clienteRazonSocial,
          cliente_documento: tipoComprobante === 'boleta' ? clienteDni : null,
          cliente_ruc: tipoComprobante === 'factura' ? clienteRuc : null,
          cliente_razon_social: tipoComprobante === 'factura' ? clienteRazonSocial : null,
          cliente_direccion: tipoComprobante === 'factura' ? clienteDireccion : null,
          subtotal: subtotal,
          igv: igv,
          total: orden.total
        });

      if (insertError) throw insertError;

      // Update numbering
      const updateField = tipoComprobante === 'boleta' ? 'numero_boleta' : 'numero_factura';
      const { error: updateError } = await supabase
        .from('configuracion_empresa')
        .update({ [updateField]: numero + 1 })
        .eq('id', empresaConfig.id);

      if (updateError) throw updateError;

      return { serie, numero };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion-empresa'] });
      toast.success('Comprobante generado exitosamente');
      setShowPreview(true);
    },
    onError: (error: any) => {
      toast.error('Error al generar comprobante: ' + error.message);
    }
  });

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    documentTitle: `${tipoComprobante === 'boleta' ? 'Boleta' : 'Factura'}-${empresaConfig?.serie_boleta || 'B001'}`
  });

  const handleGenerarYPrevisualizar = () => {
    // Validate
    if (tipoComprobante === 'factura') {
      if (!clienteRuc || clienteRuc.length !== 11) {
        toast.error('El RUC debe tener 11 dígitos');
        return;
      }
      if (!clienteRazonSocial.trim()) {
        toast.error('La razón social es requerida');
        return;
      }
    }

    if (!empresaConfig) {
      toast.error('Configura primero los datos de la empresa en Configuración');
      return;
    }

    createComprobante.mutate();
  };

  const resetForm = () => {
    setTipoComprobante('boleta');
    setFormato('ticket');
    setShowPreview(false);
    setClienteNombre('');
    setClienteDni('');
    setClienteRazonSocial('');
    setClienteRuc('');
    setClienteDireccion('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Prepare comprobante data for preview
  const comprobanteData = orden && empresaConfig ? {
    tipo: tipoComprobante,
    serie: tipoComprobante === 'boleta' ? empresaConfig.serie_boleta : empresaConfig.serie_factura,
    numero: tipoComprobante === 'boleta' ? empresaConfig.numero_boleta : empresaConfig.numero_factura,
    fecha: new Date(),
    empresa: {
      nombre_comercial: empresaConfig.nombre_comercial,
      razon_social: empresaConfig.razon_social,
      ruc: empresaConfig.ruc,
      direccion: empresaConfig.direccion,
      telefono: empresaConfig.telefono,
      mensaje_pie: empresaConfig.mensaje_pie,
      logo_url: empresaConfig.logo_url
    },
    cliente: tipoComprobante === 'boleta' 
      ? { nombre: clienteNombre || orden.nombre_invitado || 'Consumidor Final', documento: clienteDni }
      : { razon_social: clienteRazonSocial, ruc: clienteRuc, direccion: clienteDireccion },
    items: orderItems,
    subtotal: orden.total / 1.18,
    igv: orden.total - (orden.total / 1.18),
    total: orden.total,
    mesa: orden.numero_mesa || undefined,
    metodo_pago: orden.metodo_pago || undefined
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Emitir Comprobante - Mesa {orden?.numero_mesa}
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Tipo de comprobante */}
            <div className="space-y-3">
              <Label>Tipo de Comprobante</Label>
              <RadioGroup 
                value={tipoComprobante} 
                onValueChange={(v) => setTipoComprobante(v as 'boleta' | 'factura')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="boleta" id="boleta" />
                  <Label htmlFor="boleta" className="flex items-center gap-2 cursor-pointer">
                    <Receipt className="h-4 w-4" />
                    Boleta de Venta
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="factura" id="factura" />
                  <Label htmlFor="factura" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Factura
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Client data */}
            {tipoComprobante === 'boleta' ? (
              <div className="space-y-4 p-4 border rounded-lg bg-secondary/30">
                <h4 className="font-medium">Datos del Cliente (opcional para boleta)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cliente-nombre">Nombre</Label>
                    <Input
                      id="cliente-nombre"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      placeholder={orden?.nombre_invitado || 'Consumidor Final'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cliente-dni">DNI</Label>
                    <Input
                      id="cliente-dni"
                      value={clienteDni}
                      onChange={(e) => setClienteDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="12345678"
                      maxLength={8}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4 border rounded-lg bg-secondary/30">
                <h4 className="font-medium">Datos del Cliente (requeridos para factura)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cliente-ruc">RUC *</Label>
                    <Input
                      id="cliente-ruc"
                      value={clienteRuc}
                      onChange={(e) => setClienteRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="20123456789"
                      maxLength={11}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cliente-razon">Razón Social *</Label>
                    <Input
                      id="cliente-razon"
                      value={clienteRazonSocial}
                      onChange={(e) => setClienteRazonSocial(e.target.value)}
                      placeholder="Empresa S.A.C."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cliente-dir">Dirección</Label>
                  <Input
                    id="cliente-dir"
                    value={clienteDireccion}
                    onChange={(e) => setClienteDireccion(e.target.value)}
                    placeholder="Av. Principal 123"
                  />
                </div>
              </div>
            )}

            {/* Format selection */}
            <div className="space-y-3">
              <Label>Formato de Impresión</Label>
              <Tabs value={formato} onValueChange={(v) => setFormato(v as 'ticket' | 'a5')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ticket">Ticket Térmico (80mm)</TabsTrigger>
                  <TabsTrigger value="a5">Media Carta (A5)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Order summary */}
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Resumen del Pedido</h4>
              <div className="text-sm space-y-1">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.cantidad}x {item.productos?.nombre || 'Producto'}</span>
                    <span>S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 font-bold flex justify-between">
                  <span>Total:</span>
                  <span>S/ {orden?.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {!empresaConfig && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                ⚠️ No hay configuración de empresa. Ve a <strong>Configuración</strong> para agregar los datos de tu negocio.
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Preview */}
            <ScrollArea className="flex-1 border rounded-lg bg-gray-100 p-4">
              <div className="flex justify-center">
                {comprobanteData && (
                  <TicketComprobante 
                    ref={ticketRef}
                    data={comprobanteData}
                    formato={formato}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!showPreview ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button 
                onClick={handleGenerarYPrevisualizar}
                disabled={createComprobante.isPending || !empresaConfig}
              >
                {createComprobante.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generar Comprobante
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button onClick={() => handlePrint()}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}