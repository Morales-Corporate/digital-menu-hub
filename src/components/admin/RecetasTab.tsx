import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, BookOpen, AlertTriangle, ChefHat, Wallet,
  TrendingUp, Percent, Search, CheckCircle2,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function getUnitLabel(base: string): string {
  if (base === 'g') return 'Gramos (g)';
  if (base === 'ml') return 'Mililitros (ml)';
  if (base === 'unidad') return 'Unidad(es)';
  return base;
}

function formatStock(value: number, unit: string): string {
  if (unit === 'g' && value >= 1000) return `${(value / 1000).toFixed(2)} kg`;
  if (unit === 'ml' && value >= 1000) return `${(value / 1000).toFixed(2)} lt`;
  return `${value % 1 === 0 ? value : value.toFixed(2)} ${unit}`;
}

export default function RecetasTab() {
  const [selectedProducto, setSelectedProducto] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filtroReceta, setFiltroReceta] = useState<'todos' | 'con' | 'sin'>('todos');
  const [addDialog, setAddDialog] = useState(false);
  const [newInsumoId, setNewInsumoId] = useState('');
  const [newCantidad, setNewCantidad] = useState<number>(0);
  const queryClient = useQueryClient();

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('productos').select('*').order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const { data: insumos } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*').order('nombre');
      if (error) throw error;
      return data;
    },
  });

  // Cuenta de insumos por producto (para distinguir con/sin receta)
  const { data: recetaCounts } = useQuery({
    queryKey: ['producto_insumos_counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('producto_insumos').select('producto_id');
      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((r: any) => map.set(r.producto_id, (map.get(r.producto_id) || 0) + 1));
      return map;
    },
  });

  const { data: receta, isLoading: loadingReceta } = useQuery({
    queryKey: ['producto_insumos', selectedProducto],
    queryFn: async () => {
      if (!selectedProducto) return [];
      const { data, error } = await supabase
        .from('producto_insumos')
        .select('*, insumos(*)')
        .eq('producto_id', selectedProducto);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProducto,
  });

  // Solo productos elaborados aparecen en recetas
  const productosElaborados = useMemo(
    () => (productos || []).filter((p: any) => (p.tipo_producto ?? 'elaborado') === 'elaborado'),
    [productos]
  );

  const conReceta = useMemo(
    () => productosElaborados.filter((p: any) => (recetaCounts?.get(p.id) || 0) > 0).length,
    [productosElaborados, recetaCounts]
  );
  const sinReceta = productosElaborados.length - conReceta;

  const productoActual = productos?.find((p: any) => p.id === selectedProducto);
  const selectedInsumo = insumos?.find((i: any) => i.id === newInsumoId);
  const unidadAuto = selectedInsumo?.unidad_medida || '';
  const costoEstimado = selectedInsumo ? newCantidad * Number(selectedInsumo.costo_por_unidad || 0) : 0;
  const stockInsuficienteForm = selectedInsumo && newCantidad > Number(selectedInsumo.stock_actual);

  // Insumos ya en la receta (para excluirlos del selector)
  const insumosEnReceta = useMemo(
    () => new Set((receta || []).map((r: any) => r.insumo_id)),
    [receta]
  );
  const insumosDisponibles = useMemo(
    () => (insumos || []).filter((i: any) => !insumosEnReceta.has(i.id)),
    [insumos, insumosEnReceta]
  );

  const productosFiltered = useMemo(() => {
    let list = productosElaborados;
    if (filtroReceta === 'con') list = list.filter((p: any) => (recetaCounts?.get(p.id) || 0) > 0);
    else if (filtroReceta === 'sin') list = list.filter((p: any) => (recetaCounts?.get(p.id) || 0) === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p: any) => p.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [productosElaborados, recetaCounts, search, filtroReceta]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('producto_insumos').insert([{
        producto_id: selectedProducto,
        insumo_id: newInsumoId,
        cantidad: newCantidad,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producto_insumos', selectedProducto] });
      queryClient.invalidateQueries({ queryKey: ['producto_insumos_counts'] });
      toast.success('Insumo agregado a la receta');
      setAddDialog(false);
      setNewInsumoId('');
      setNewCantidad(0);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('producto_insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producto_insumos', selectedProducto] });
      queryClient.invalidateQueries({ queryKey: ['producto_insumos_counts'] });
      toast.success('Insumo removido');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Costos siempre dinámicos: recalcula con costo actual del insumo
  const costoTotal = (receta || []).reduce(
    (acc: number, r: any) => acc + Number(r.cantidad) * Number(r.insumos?.costo_por_unidad || 0),
    0
  );
  const precioVenta = Number(productoActual?.precio || 0);
  const ganancia = precioVenta - costoTotal;
  const margenPct = precioVenta > 0 ? (ganancia / precioVenta) * 100 : 0;

  const stockWarnings = (receta || []).filter(
    (r: any) => Number(r.insumos?.stock_actual || 0) < Number(r.cantidad)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Sidebar de productos */}
      <Card className="h-fit lg:sticky lg:top-4">
        <CardContent className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              className="pl-8 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-1">
            {productosFiltered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin productos</p>
            ) : productosFiltered.map((p: any) => {
              const isActive = p.id === selectedProducto;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProducto(p.id)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-transparent hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{p.nombre}</span>
                    <span className={cn(
                      "text-[11px] shrink-0 tabular-nums",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      S/ {Number(p.precio).toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Panel principal */}
      <div className="space-y-4 min-w-0">
        {!selectedProducto ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <ChefHat className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Constructor de recetas</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Selecciona un producto para construir su receta, calcular costos y márgenes en tiempo real.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header del producto */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold leading-tight">{productoActual?.nombre}</h2>
                <p className="text-xs text-muted-foreground">
                  {(receta?.length || 0)} {(receta?.length || 0) === 1 ? 'insumo' : 'insumos'} en la receta
                </p>
              </div>
              <Button size="sm" onClick={() => setAddDialog(true)} className="h-9">
                <Plus className="h-4 w-4 mr-1.5" />
                Agregar insumo
              </Button>
            </div>

            {/* Resumen financiero (KPI cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                icon={<Wallet className="h-4 w-4" />}
                label="Costo producción"
                value={`S/ ${costoTotal.toFixed(2)}`}
                tone="muted"
              />
              <KpiCard
                icon={<BookOpen className="h-4 w-4" />}
                label="Precio venta"
                value={`S/ ${precioVenta.toFixed(2)}`}
                tone="info"
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Ganancia"
                value={`S/ ${ganancia.toFixed(2)}`}
                tone={ganancia >= 0 ? 'success' : 'danger'}
              />
              <KpiCard
                icon={<Percent className="h-4 w-4" />}
                label="Margen"
                value={`${margenPct.toFixed(1)}%`}
                tone={margenPct >= 30 ? 'success' : margenPct >= 0 ? 'warning' : 'danger'}
              />
            </div>

            {/* Alerta stock */}
            {stockWarnings.length > 0 && (
              <div className="rounded-lg border border-orange-400/50 bg-orange-50 dark:bg-orange-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-medium text-orange-700 dark:text-orange-400">
                      Stock insuficiente para preparar este producto
                    </p>
                    {stockWarnings.map((r: any) => (
                      <p key={r.id} className="text-orange-700/80 dark:text-orange-300/80">
                        {r.insumos?.nombre}: necesita {formatStock(Number(r.cantidad), r.insumos?.unidad_medida)} · disponible {formatStock(Number(r.insumos?.stock_actual), r.insumos?.unidad_medida)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de receta */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                {loadingReceta ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : !receta?.length ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Aún no hay insumos en esta receta
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setAddDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Agregar primer insumo
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="h-10">Insumo</TableHead>
                        <TableHead className="h-10 text-right">Cantidad</TableHead>
                        <TableHead className="h-10">Unidad</TableHead>
                        <TableHead className="h-10 text-right">Costo</TableHead>
                        <TableHead className="h-10">Stock actual</TableHead>
                        <TableHead className="h-10 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receta.map((r: any) => {
                        const ins = r.insumos;
                        const unit = ins?.unidad_medida || '';
                        const cantidad = Number(r.cantidad);
                        const stock = Number(ins?.stock_actual || 0);
                        const costo = cantidad * Number(ins?.costo_por_unidad || 0);
                        const insufficient = stock < cantidad;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium py-2.5">{ins?.nombre}</TableCell>
                            <TableCell className="text-right tabular-nums py-2.5">
                              {cantidad % 1 === 0 ? cantidad : cantidad.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="secondary" className="font-mono text-[11px]">{unit}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums py-2.5 font-medium">
                              S/ {costo.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "text-xs tabular-nums",
                                  insufficient ? "text-destructive font-medium" : "text-muted-foreground"
                                )}>
                                  {formatStock(stock, unit)}
                                </span>
                                {insufficient ? (
                                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                    Insuficiente
                                  </Badge>
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  if (confirm(`¿Eliminar ${ins?.nombre} de la receta?`)) {
                                    removeMutation.mutate(r.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30 hover:bg-muted/30 font-semibold">
                        <TableCell colSpan={3} className="py-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground">
                          Costo total de la receta
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums text-primary">
                          S/ {costoTotal.toFixed(2)}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Modal Agregar Insumo */}
      <Dialog open={addDialog} onOpenChange={(o) => { setAddDialog(o); if (!o) { setNewInsumoId(''); setNewCantidad(0); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar insumo a la receta</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Sección 1: Selector insumo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Insumo
              </Label>
              <Select value={newInsumoId} onValueChange={setNewInsumoId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar insumo..." />
                </SelectTrigger>
                <SelectContent>
                  {insumosDisponibles.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Todos los insumos ya están en la receta
                    </div>
                  ) : insumosDisponibles.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      <div className="flex items-center gap-2">
                        <span>{i.nombre}</span>
                        <span className="text-xs text-muted-foreground">({i.unidad_medida})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sección 2 + 3: Cantidad + Unidad automática */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Cantidad y unidad
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-10 flex-1"
                  placeholder="0"
                  value={newCantidad}
                  onChange={e => setNewCantidad(parseFloat(e.target.value) || 0)}
                  disabled={!newInsumoId}
                />
                <div className="h-10 px-3 rounded-md border bg-muted/50 flex items-center min-w-[80px] justify-center">
                  <span className="font-mono text-sm font-semibold">
                    {unidadAuto || '—'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                La unidad se hereda automáticamente del insumo: <span className="font-medium">{getUnitLabel(unidadAuto) || '—'}</span>
              </p>
            </div>

            {/* Sección 4: Costo estimado dinámico */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3. Costo estimado
              </Label>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {selectedInsumo ? (
                    <>S/ {Number(selectedInsumo.costo_por_unidad).toFixed(4)} / {unidadAuto} × {newCantidad || 0}</>
                  ) : (
                    'Selecciona un insumo'
                  )}
                </div>
                <span className="text-lg font-bold text-primary tabular-nums">
                  S/ {costoEstimado.toFixed(2)}
                </span>
              </div>
              {selectedInsumo && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t">
                  <span className="text-muted-foreground">
                    Stock disponible: {formatStock(Number(selectedInsumo.stock_actual), unidadAuto)}
                  </span>
                  {stockInsuficienteForm && (
                    <Badge variant="destructive" className="text-[10px] h-5">
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      Stock insuficiente
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAddDialog(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!newInsumoId || newCantidad <= 0 || addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Agregar a la receta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== KPI Card ==========
function KpiCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'muted' | 'info' | 'success' | 'warning' | 'danger';
}) {
  const toneClasses = {
    muted: 'bg-muted/40 border-border text-foreground',
    info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300',
    success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900 text-yellow-700 dark:text-yellow-300',
    danger: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300',
  }[tone];

  return (
    <div className={cn("rounded-lg border p-3", toneClasses)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-1.5">{value}</div>
    </div>
  );
}
