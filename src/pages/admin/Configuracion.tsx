import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Settings, Building2, FileText, Hash, Save, Loader2, Store } from 'lucide-react';

interface ConfiguracionEmpresa {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
  serie_boleta: string;
  numero_boleta: number;
  serie_factura: string;
  numero_factura: number;
  mensaje_pie: string | null;
  tipo_negocio: string;
  estados_pedido_visibles: string[];
}

export default function Configuracion() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<ConfiguracionEmpresa>>({
    nombre_comercial: '',
    razon_social: '',
    ruc: '',
    direccion: '',
    telefono: '',
    email: '',
    logo_url: '',
    serie_boleta: 'B001',
    numero_boleta: 1,
    serie_factura: 'F001',
    numero_factura: 1,
    mensaje_pie: 'Gracias por su preferencia',
    tipo_negocio: 'restaurante',
    estados_pedido_visibles: ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'pagado'],
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracion-empresa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracion_empresa')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as ConfiguracionEmpresa | null;
    }
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ConfiguracionEmpresa>) => {
      if (config?.id) {
        // Update existing
        const { error } = await supabase
          .from('configuracion_empresa')
          .update({
            nombre_comercial: data.nombre_comercial,
            razon_social: data.razon_social,
            ruc: data.ruc,
            direccion: data.direccion,
            telefono: data.telefono,
            email: data.email,
            logo_url: data.logo_url,
            serie_boleta: data.serie_boleta,
            numero_boleta: data.numero_boleta,
            serie_factura: data.serie_factura,
            numero_factura: data.numero_factura,
            mensaje_pie: data.mensaje_pie,
            tipo_negocio: data.tipo_negocio,
            estados_pedido_visibles: data.estados_pedido_visibles,
          })
          .eq('id', config.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('configuracion_empresa')
          .insert({
            nombre_comercial: data.nombre_comercial || 'Mi Restaurante',
            razon_social: data.razon_social,
            ruc: data.ruc,
            direccion: data.direccion,
            telefono: data.telefono,
            email: data.email,
            logo_url: data.logo_url,
            serie_boleta: data.serie_boleta || 'B001',
            numero_boleta: data.numero_boleta || 1,
            serie_factura: data.serie_factura || 'F001',
            numero_factura: data.numero_factura || 1,
            mensaje_pie: data.mensaje_pie
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion-empresa'] });
      toast.success('Configuración guardada correctamente');
    },
    onError: (error: any) => {
      toast.error('Error al guardar: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre_comercial?.trim()) {
      toast.error('El nombre comercial es requerido');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleChange = (field: keyof ConfiguracionEmpresa, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold">Configuración</h1>
            <p className="text-muted-foreground">Datos de la empresa y comprobantes</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos de la Empresa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Datos de la Empresa
              </CardTitle>
              <CardDescription>
                Información que aparecerá en los comprobantes de pago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre_comercial">Nombre Comercial *</Label>
                  <Input
                    id="nombre_comercial"
                    value={formData.nombre_comercial || ''}
                    onChange={(e) => handleChange('nombre_comercial', e.target.value)}
                    placeholder="Mi Restaurante"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razon_social">Razón Social</Label>
                  <Input
                    id="razon_social"
                    value={formData.razon_social || ''}
                    onChange={(e) => handleChange('razon_social', e.target.value)}
                    placeholder="Empresa S.A.C."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ruc">RUC</Label>
                  <Input
                    id="ruc"
                    value={formData.ruc || ''}
                    onChange={(e) => handleChange('ruc', e.target.value)}
                    placeholder="20123456789"
                    maxLength={11}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono || ''}
                    onChange={(e) => handleChange('telefono', e.target.value)}
                    placeholder="(01) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion || ''}
                  onChange={(e) => handleChange('direccion', e.target.value)}
                  placeholder="Av. Principal 123, Lima"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contacto@mirestaurante.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">URL del Logo (opcional)</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url || ''}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Numeración de Comprobantes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Numeración de Comprobantes
              </CardTitle>
              <CardDescription>
                Configura las series y números iniciales para boletas y facturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Boleta de Venta
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serie_boleta">Serie</Label>
                    <Input
                      id="serie_boleta"
                      value={formData.serie_boleta || ''}
                      onChange={(e) => handleChange('serie_boleta', e.target.value.toUpperCase())}
                      placeholder="B001"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_boleta">Número Actual</Label>
                    <Input
                      id="numero_boleta"
                      type="number"
                      value={formData.numero_boleta || 1}
                      onChange={(e) => handleChange('numero_boleta', parseInt(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Próxima boleta: {formData.serie_boleta}-{String(formData.numero_boleta || 1).padStart(8, '0')}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Factura
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serie_factura">Serie</Label>
                    <Input
                      id="serie_factura"
                      value={formData.serie_factura || ''}
                      onChange={(e) => handleChange('serie_factura', e.target.value.toUpperCase())}
                      placeholder="F001"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_factura">Número Actual</Label>
                    <Input
                      id="numero_factura"
                      type="number"
                      value={formData.numero_factura || 1}
                      onChange={(e) => handleChange('numero_factura', parseInt(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Próxima factura: {formData.serie_factura}-{String(formData.numero_factura || 1).padStart(8, '0')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mensaje de Pie */}
          <Card>
            <CardHeader>
              <CardTitle>Mensaje en Comprobante</CardTitle>
              <CardDescription>
                Texto que aparecerá al final del ticket
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.mensaje_pie || ''}
                onChange={(e) => handleChange('mensaje_pie', e.target.value)}
                placeholder="Gracias por su preferencia"
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar Configuración
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}