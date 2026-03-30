import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, TrendingUp, DollarSign, Receipt, Building2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORIAS_COSTO = [
  { value: 'servicios', label: 'Servicios (luz, agua, internet)' },
  { value: 'personal', label: 'Personal / Salarios' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'otros', label: 'Otros' },
];

const PERIODOS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'semanal', label: 'Semanal' },
];

// ========== COSTOS OPERATIVOS TAB ==========
function CostosOperativosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', categoria: 'servicios', monto: 0, periodo: 'mensual', activo: true });
  const queryClient = useQueryClient();

  const { data: costos, isLoading } = useQuery({
    queryKey: ['costos_operativos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('costos_operativos').select('*').order('categoria, nombre');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('costos_operativos').update(form).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('costos_operativos').insert([form]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costos_operativos'] });
      toast.success(editingId ? 'Costo actualizado' : 'Costo registrado');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('costos_operativos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costos_operativos'] });
      toast.success('Costo eliminado');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ nombre: '', categoria: 'servicios', monto: 0, periodo: 'mensual', activo: true });
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ nombre: c.nombre, categoria: c.categoria, monto: Number(c.monto), periodo: c.periodo, activo: c.activo });
    setDialogOpen(true);
  };

  const totalMensual = costos?.filter((c: any) => c.activo).reduce((acc: number, c: any) => {
    const monto = Number(c.monto);
    if (c.periodo === 'mensual') return acc + monto;
    if (c.periodo === 'quincenal') return acc + monto * 2;
    if (c.periodo === 'semanal') return acc + monto * 4;
    return acc + monto;
  }, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-muted-foreground">Registra los costos fijos operativos del negocio</p>
          <p className="text-sm font-semibold text-primary mt-1">Total mensual estimado: S/ {totalMensual.toFixed(2)}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nuevo Costo</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !costos?.length ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No hay costos operativos registrados.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {costos.map((c: any) => (
            <Card key={c.id} className={!c.activo ? 'opacity-50' : ''}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{CATEGORIAS_COSTO.find(cat => cat.value === c.categoria)?.label || c.categoria}</Badge>
                      <Badge variant="secondary">{PERIODOS.find(p => p.value === c.periodo)?.label}</Badge>
                      {!c.activo && <Badge variant="destructive">Inactivo</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-lg">S/ {Number(c.monto).toFixed(2)}</p>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar "${c.nombre}"?`)) deleteMutation.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar Costo Operativo' : 'Nuevo Costo Operativo'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Electricidad, Alquiler, Salario cocinero" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoría</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS_COSTO.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Periodo</Label>
                <Select value={form.periodo} onValueChange={v => setForm(f => ({ ...f, periodo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Monto (S/)</Label><Input type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.activo} onCheckedChange={v => setForm(f => ({ ...f, activo: v }))} />
              <Label>Activo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.nombre}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== UTILIDAD TAB ==========
function UtilidadTab() {
  const [rango, setRango] = useState('30');

  const desde = subDays(new Date(), parseInt(rango));
  const desdeStr = desde.toISOString();

  // Ventas en el periodo
  const { data: ordenes, isLoading: loadingOrdenes } = useQuery({
    queryKey: ['reportes_ordenes', rango],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordenes')
        .select('id, total, created_at, estado')
        .gte('created_at', desdeStr)
        .in('estado', ['entregado', 'confirmado', 'listo']);
      if (error) throw error;
      return data;
    },
  });

  // Items de ordenes para calcular costo de insumos
  const { data: ordenItems } = useQuery({
    queryKey: ['reportes_orden_items', rango],
    queryFn: async () => {
      if (!ordenes?.length) return [];
      const ordenIds = ordenes.map(o => o.id);
      const { data, error } = await supabase
        .from('orden_items')
        .select('producto_id, cantidad')
        .in('orden_id', ordenIds);
      if (error) throw error;
      return data;
    },
    enabled: !!ordenes?.length,
  });

  // Recetas (producto -> insumos)
  const { data: recetas } = useQuery({
    queryKey: ['reportes_recetas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('producto_insumos').select('producto_id, cantidad, insumos(costo_por_unidad)');
      if (error) throw error;
      return data;
    },
  });

  // Compras de insumos en el periodo
  const { data: compras } = useQuery({
    queryKey: ['reportes_compras', rango],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compras_insumos')
        .select('costo_total, created_at')
        .gte('created_at', desdeStr);
      if (error) throw error;
      return data;
    },
  });

  // Costos operativos
  const { data: costosOp } = useQuery({
    queryKey: ['costos_operativos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('costos_operativos').select('*').eq('activo', true);
      if (error) throw error;
      return data;
    },
  });

  // Cálculos
  const totalVentas = ordenes?.reduce((acc, o) => acc + Number(o.total), 0) || 0;

  // Costo de insumos consumidos (basado en recetas)
  const costoInsumosConsumidos = (() => {
    if (!ordenItems?.length || !recetas?.length) return 0;
    let total = 0;
    for (const item of ordenItems) {
      const recetasProducto = recetas.filter(r => r.producto_id === item.producto_id);
      for (const r of recetasProducto) {
        total += Number(r.cantidad) * item.cantidad * Number((r as any).insumos?.costo_por_unidad || 0);
      }
    }
    return total;
  })();

  const totalCompras = compras?.reduce((acc, c) => acc + Number(c.costo_total), 0) || 0;

  const dias = parseInt(rango);
  const costoOpMensual = costosOp?.reduce((acc: number, c: any) => {
    const monto = Number(c.monto);
    if (c.periodo === 'mensual') return acc + monto;
    if (c.periodo === 'quincenal') return acc + monto * 2;
    if (c.periodo === 'semanal') return acc + monto * 4;
    return acc + monto;
  }, 0) || 0;
  const costoOpPeriodo = (costoOpMensual / 30) * dias;

  const utilidadBruta = totalVentas - costoInsumosConsumidos;
  const utilidadNeta = utilidadBruta - costoOpPeriodo;
  const margenBruto = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0;
  const margenNeto = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : 0;

  const loading = loadingOrdenes;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Análisis de utilidad del negocio</p>
        <Select value={rango} onValueChange={setRango}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="15">Últimos 15 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="60">Últimos 60 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Ventas totales</span>
                </div>
                <p className="text-2xl font-bold">S/ {totalVentas.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{ordenes?.length || 0} órdenes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Receipt className="h-4 w-4" />
                  <span className="text-sm">Costo insumos</span>
                </div>
                <p className="text-2xl font-bold text-orange-500">S/ {costoInsumosConsumidos.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Basado en recetas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm">Costos operativos</span>
                </div>
                <p className="text-2xl font-bold text-orange-500">S/ {costoOpPeriodo.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Proporcional a {dias} días</p>
              </CardContent>
            </Card>
            <Card className={utilidadNeta >= 0 ? 'border-green-500/50' : 'border-destructive/50'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Utilidad neta</span>
                </div>
                <p className={`text-2xl font-bold ${utilidadNeta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                  S/ {utilidadNeta.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Margen: {margenNeto.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Desglose */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Desglose de utilidad</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">% sobre ventas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Ventas totales</TableCell>
                    <TableCell className="text-right font-semibold">S/ {totalVentas.toFixed(2)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-destructive">(-) Costo de insumos consumidos</TableCell>
                    <TableCell className="text-right text-destructive">S/ {costoInsumosConsumidos.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive">{totalVentas > 0 ? ((costoInsumosConsumidos / totalVentas) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">= Utilidad bruta</TableCell>
                    <TableCell className="text-right font-semibold">S/ {utilidadBruta.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{margenBruto.toFixed(1)}%</TableCell>
                  </TableRow>
                  {costosOp?.map((c: any) => {
                    const montoMensual = c.periodo === 'mensual' ? Number(c.monto) : c.periodo === 'quincenal' ? Number(c.monto) * 2 : Number(c.monto) * 4;
                    const montoPeriodo = (montoMensual / 30) * dias;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground pl-8">(-) {c.nombre}</TableCell>
                        <TableCell className="text-right text-muted-foreground">S/ {montoPeriodo.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{totalVentas > 0 ? ((montoPeriodo / totalVentas) * 100).toFixed(1) : 0}%</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className={utilidadNeta >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}>
                    <TableCell className="font-bold text-lg">= Utilidad neta</TableCell>
                    <TableCell className={`text-right font-bold text-lg ${utilidadNeta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      S/ {utilidadNeta.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${utilidadNeta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      {margenNeto.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Compras vs Ventas */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Compras de insumos en el periodo</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total invertido en compras</p>
                  <p className="text-xl font-bold">S/ {totalCompras.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retorno sobre inversión en insumos</p>
                  <p className="text-xl font-bold text-primary">
                    {totalCompras > 0 ? ((totalVentas / totalCompras) * 100).toFixed(0) : '—'}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function Reportes() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">Reportes de Costos y Utilidad</h1>

        <Tabs defaultValue="utilidad">
          <TabsList>
            <TabsTrigger value="utilidad"><TrendingUp className="h-4 w-4 mr-2" />Utilidad</TabsTrigger>
            <TabsTrigger value="costos"><Building2 className="h-4 w-4 mr-2" />Costos Operativos</TabsTrigger>
          </TabsList>

          <TabsContent value="utilidad"><UtilidadTab /></TabsContent>
          <TabsContent value="costos"><CostosOperativosTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
