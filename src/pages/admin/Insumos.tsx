import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Package, AlertTriangle, ShoppingCart, BookOpen, Bell, Check, Search, SlidersHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import InsumosTab from '@/components/admin/InsumosTab';
import RecetasTab from '@/components/admin/RecetasTab';

// ========== UNIT SYSTEM ==========
const UNIDADES_BASE = [
  { value: 'g', label: 'Gramos (g)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unidad', label: 'Unidad(es)' },
];

const UNIDADES_COMPRA: Record<string, { value: string; label: string; factor: number }[]> = {
  g: [
    { value: 'g', label: 'Gramos (g)', factor: 1 },
    { value: 'kg', label: 'Kilogramos (kg)', factor: 1000 },
  ],
  ml: [
    { value: 'ml', label: 'Mililitros (ml)', factor: 1 },
    { value: 'lt', label: 'Litros (lt)', factor: 1000 },
  ],
  unidad: [
    { value: 'unidad', label: 'Unidad(es)', factor: 1 },
  ],
};

// Also allow recipe quantities in convertible units
const UNIDADES_RECETA = UNIDADES_COMPRA;

function getUnitLabel(base: string): string {
  return UNIDADES_BASE.find(u => u.value === base)?.label || base;
}

function getUnitAbbr(base: string): string {
  return base;
}

function convertToBase(cantidad: number, unidadCompra: string, unidadBase: string): number {
  const opciones = UNIDADES_COMPRA[unidadBase] || [];
  const opcion = opciones.find(o => o.value === unidadCompra);
  return cantidad * (opcion?.factor || 1);
}

function formatStock(value: number, unit: string): string {
  if (unit === 'g' && value >= 1000) return `${(value / 1000).toFixed(2)} kg`;
  if (unit === 'ml' && value >= 1000) return `${(value / 1000).toFixed(2)} lt`;
  return `${value % 1 === 0 ? value : value.toFixed(2)} ${unit}`;
}

function getStockPercentage(stockActual: number, stockRef: number): number {
  if (stockRef <= 0) return -1;
  return Math.min(100, Math.max(0, (stockActual / stockRef) * 100));
}

function getStockColor(pct: number): { bg: string; text: string; label: string } {
  if (pct > 60) return { bg: 'bg-green-500', text: 'text-green-600 dark:text-green-400', label: 'Óptimo' };
  if (pct > 30) return { bg: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', label: 'Medio' };
  return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Bajo' };
}

// RecetasTab moved to src/components/admin/RecetasTab.tsx

// ========== COMPRAS TAB ==========
function ComprasTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ insumo_id: '', cantidad: 0, unidad_compra: '', costo_unitario: 0, proveedor: '', nota: '' });
  const queryClient = useQueryClient();

  const { data: insumos } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*').order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const { data: compras, isLoading } = useQuery({
    queryKey: ['compras_insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('compras_insumos').select('*, insumos(nombre, unidad_medida)').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const selectedInsumo = insumos?.find((i: any) => i.id === form.insumo_id);
  const unidadesCompra = selectedInsumo ? (UNIDADES_COMPRA[selectedInsumo.unidad_medida] || []) : [];

  const handleInsumoChange = (id: string) => {
    const ins = insumos?.find((i: any) => i.id === id);
    setForm(f => ({ ...f, insumo_id: id, unidad_compra: ins?.unidad_medida || '' }));
  };

  const cantidadEnBase = useMemo(() => {
    if (!selectedInsumo) return form.cantidad;
    return convertToBase(form.cantidad, form.unidad_compra, selectedInsumo.unidad_medida);
  }, [form.cantidad, form.unidad_compra, selectedInsumo]);

  // Costo por unidad base
  const costoTotal = form.cantidad * form.costo_unitario;
  const costoPorBase = cantidadEnBase > 0 ? costoTotal / cantidadEnBase : 0;

  const compraMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInsumo) throw new Error('Selecciona un insumo');

      // Insert purchase record (stored in base units)
      const { error: compraError } = await supabase.from('compras_insumos').insert([{
        insumo_id: form.insumo_id,
        cantidad: cantidadEnBase,
        costo_unitario: costoPorBase,
        costo_total: costoTotal,
        proveedor: form.proveedor || null,
        nota: form.nota || null,
      }]);
      if (compraError) throw compraError;

      // Update insumo stock
      const newStock = Number(selectedInsumo.stock_actual) + cantidadEnBase;
      const { error: updateError } = await supabase.from('insumos').update({
        stock_actual: newStock,
        costo_por_unidad: costoPorBase,
      }).eq('id', form.insumo_id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras_insumos'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast.success('Compra registrada y stock actualizado');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Registra compras para reabastecer el stock</p>
        <Button onClick={() => { setForm({ insumo_id: '', cantidad: 0, unidad_compra: '', costo_unitario: 0, proveedor: '', nota: '' }); setDialogOpen(true); }}>
          <ShoppingCart className="h-4 w-4 mr-2" />Registrar Compra
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      ) : !compras?.length ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No hay compras registradas.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {compras.map((c: any) => {
            const unit = (c as any).insumos?.unidad_medida || '';
            return (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{(c as any).insumos?.nombre}</span>
                    <span className="text-muted-foreground ml-2">+{formatStock(Number(c.cantidad), unit)}</span>
                    {c.proveedor && <Badge variant="outline" className="ml-2">{c.proveedor}</Badge>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">S/ {Number(c.costo_total).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Insumo</Label>
              <Select value={form.insumo_id} onValueChange={handleInsumoChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo..." /></SelectTrigger>
                <SelectContent>{insumos?.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nombre} (base: {getUnitAbbr(i.unidad_medida)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantidad comprada</Label>
                <Input type="number" step="0.01" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Unidad de compra</Label>
                <Select value={form.unidad_compra} onValueChange={v => setForm(f => ({ ...f, unidad_compra: v }))}>
                  <SelectTrigger><SelectValue placeholder="Unidad..." /></SelectTrigger>
                  <SelectContent>{unidadesCompra.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Costo total de la compra (S/)</Label>
              <Input type="number" step="0.01" value={form.costo_unitario > 0 ? costoTotal : ''} onChange={e => {
                const total = parseFloat(e.target.value) || 0;
                setForm(f => ({ ...f, costo_unitario: f.cantidad > 0 ? total / f.cantidad : 0 }));
              }} />
            </div>
            {cantidadEnBase > 0 && form.unidad_compra !== selectedInsumo?.unidad_medida && (
              <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
                <p>Conversión: <span className="font-semibold">{form.cantidad} {form.unidad_compra}</span> → <span className="font-semibold">{formatStock(cantidadEnBase, selectedInsumo?.unidad_medida || '')}</span></p>
                {costoPorBase > 0 && <p>Costo por {getUnitAbbr(selectedInsumo?.unidad_medida || '')}: <span className="font-semibold">S/ {costoPorBase.toFixed(4)}</span></p>}
              </div>
            )}
            {cantidadEnBase > 0 && form.unidad_compra === selectedInsumo?.unidad_medida && costoPorBase > 0 && (
              <p className="text-sm text-muted-foreground">Costo por {getUnitAbbr(selectedInsumo?.unidad_medida || '')}: <span className="font-semibold text-foreground">S/ {costoPorBase.toFixed(4)}</span></p>
            )}
            <div><Label>Proveedor (opcional)</Label><Input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} placeholder="Ej: Mercado Central" /></div>
            <div><Label>Nota (opcional)</Label><Input value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} placeholder="Ej: Compra semanal" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => compraMutation.mutate()} disabled={!form.insumo_id || form.cantidad <= 0 || !form.unidad_compra || compraMutation.isPending}>
                {compraMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== EMAIL FIELD COMPONENT ==========
function EmailDestinoField({ config, onSave }: { config: any; onSave: (email: string) => void }) {
  const [email, setEmail] = useState(config?.email_destino || '');
  const [saved, setSaved] = useState(true);

  const handleSave = () => {
    onSave(email);
    setSaved(true);
  };

  return (
    <div className="max-w-sm space-y-2">
      <Label>Email destino</Label>
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={e => { setEmail(e.target.value); setSaved(false); }}
          placeholder="admin@restaurante.com"
          type="email"
        />
        <Button size="sm" onClick={handleSave} disabled={saved || !email}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

// ========== ALERTAS TAB ==========
function AlertasTab() {
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['alertas_stock_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('alertas_stock_config').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas_stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('alertas_stock').select('*, insumos(nombre)').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!config) return;
      const { error } = await supabase.from('alertas_stock_config').update(updates).eq('id', config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas_stock_config'] });
      toast.success('Configuración actualizada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alertas_stock').update({ leida: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertas_stock'] }),
  });

  const unreadCount = alertas?.filter((a: any) => !a.leida).length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Configuración de alertas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label>Umbral de alerta (stock mínimo)</Label>
            <p className="text-xs text-muted-foreground mb-2">Se genera alerta cuando el stock de un insumo llegue a su mínimo configurado</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Notificaciones en el sistema</p>
              <p className="text-sm text-muted-foreground">Alertas visibles en este panel</p>
            </div>
            <Switch checked={config?.notificar_sistema ?? true} onCheckedChange={v => updateConfigMutation.mutate({ notificar_sistema: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Notificaciones por correo</p>
              <p className="text-sm text-muted-foreground">Enviar email cuando haya stock bajo</p>
            </div>
            <Switch checked={config?.notificar_email ?? false} onCheckedChange={v => updateConfigMutation.mutate({ notificar_email: v })} />
          </div>
          {config?.notificar_email && (
            <EmailDestinoField config={config} onSave={(email) => updateConfigMutation.mutate({ email_destino: email })} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alertas recientes
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          ) : !alertas?.length ? (
            <p className="text-muted-foreground text-sm text-center py-4">No hay alertas de stock</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a: any) => (
                <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${a.leida ? 'bg-muted/50' : 'bg-destructive/10 border border-destructive/30'}`}>
                  <div className="flex items-center gap-2">
                    {!a.leida && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    <div>
                      <p className={`text-sm ${a.leida ? 'text-muted-foreground' : 'font-medium'}`}>{a.mensaje}</p>
                      <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('es-PE')}</p>
                    </div>
                  </div>
                  {!a.leida && (
                    <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(a.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function Insumos() {
  const { data: alertasCount } = useQuery({
    queryKey: ['alertas_stock_unread_count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('alertas_stock').select('*', { count: 'exact', head: true }).eq('leida', false);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">Inventario de Insumos</h1>

        <Tabs defaultValue="insumos">
          <TabsList>
            <TabsTrigger value="insumos"><Package className="h-4 w-4 mr-2" />Insumos</TabsTrigger>
            <TabsTrigger value="recetas"><BookOpen className="h-4 w-4 mr-2" />Recetas</TabsTrigger>
            <TabsTrigger value="compras"><ShoppingCart className="h-4 w-4 mr-2" />Compras</TabsTrigger>
            <TabsTrigger value="alertas" className="relative">
              <Bell className="h-4 w-4 mr-2" />Alertas
              {(alertasCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">{alertasCount}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insumos"><InsumosTab /></TabsContent>
          <TabsContent value="recetas"><RecetasTab /></TabsContent>
          <TabsContent value="compras"><ComprasTab /></TabsContent>
          <TabsContent value="alertas"><AlertasTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
