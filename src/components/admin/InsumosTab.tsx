import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const UNIDADES_BASE = [
  { value: 'g', label: 'Gramos (g)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unidad', label: 'Unidad(es)' },
];

function getUnitLabel(base: string): string {
  return UNIDADES_BASE.find(u => u.value === base)?.label || base;
}

function getUnitAbbr(base: string): string {
  return base;
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
  if (pct > 60) return { bg: 'bg-green-500', text: 'text-green-700 dark:text-green-400', label: 'Óptimo' };
  if (pct > 30) return { bg: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', label: 'Medio' };
  return { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-400', label: 'Bajo' };
}

function getStockStatus(stockActual: number, stockMinimo: number): 'agotado' | 'bajo' | 'ok' {
  if (stockActual === 0) return 'agotado';
  if (stockMinimo > 0 && stockActual <= stockMinimo) return 'bajo';
  return 'ok';
}

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'bajo', label: 'Bajo stock' },
  { key: 'agotado', label: 'Sin stock' },
  { key: 'optimo', label: 'Óptimos' },
];

export default function InsumosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', unidad_medida: 'g', costo_por_unidad: 0, stock_actual: 0, stock_minimo: 0, stock_inicial_referencia: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'bajo' | 'agotado' | 'optimo'>('todos');
  const queryClient = useQueryClient();

  const { data: insumos, isLoading } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*').order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editingId) {
        const { error } = await supabase.from('insumos').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insumos').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast.success(editingId ? 'Insumo actualizado' : 'Insumo creado');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast.success('Insumo eliminado');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ nombre: '', unidad_medida: 'g', costo_por_unidad: 0, stock_actual: 0, stock_minimo: 0, stock_inicial_referencia: 0 });
    setDialogOpen(true);
  };

  const openEdit = (i: any) => {
    setEditingId(i.id);
    setForm({ nombre: i.nombre, unidad_medida: i.unidad_medida, costo_por_unidad: Number(i.costo_por_unidad), stock_actual: Number(i.stock_actual), stock_minimo: Number(i.stock_minimo), stock_inicial_referencia: Number(i.stock_inicial_referencia || 0) });
    setDialogOpen(true);
  };

  const filteredInsumos = useMemo(() => {
    if (!insumos) return [];
    let result = insumos as any[];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i: any) => i.nombre.toLowerCase().includes(q));
    }
    if (filter !== 'todos') {
      result = result.filter((i: any) => {
        const status = getStockStatus(Number(i.stock_actual), Number(i.stock_minimo));
        if (filter === 'agotado') return status === 'agotado';
        if (filter === 'bajo') return status === 'bajo';
        if (filter === 'optimo') return status === 'ok';
        return true;
      });
    }
    return result;
  }, [insumos, search, filter]);

  const filterCounts = useMemo(() => {
    if (!insumos) return {} as Record<string, number>;
    const counts: Record<string, number> = { todos: insumos.length, bajo: 0, agotado: 0, optimo: 0 };
    (insumos as any[]).forEach((i: any) => {
      const status = getStockStatus(Number(i.stock_actual), Number(i.stock_minimo));
      if (status === 'agotado') counts.agotado++;
      else if (status === 'bajo') counts.bajo++;
      else counts.optimo++;
    });
    return counts;
  }, [insumos]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo..."
            className="pl-9 h-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate} size="sm" className="h-10">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Insumo
        </Button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground mr-1" />
        {FILTERS.map(f => {
          const isActive = filter === (f.key as any);
          const count = filterCounts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !filteredInsumos?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No hay insumos {filter !== 'todos' ? 'con este filtro' : 'registrados'}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredInsumos.map((i: any) => {
            const unit = i.unidad_medida;
            const stockRef = Number(i.stock_inicial_referencia || 0);
            const stockActual = Number(i.stock_actual);
            const stockMinimo = Number(i.stock_minimo);
            const pct = getStockPercentage(stockActual, stockRef);
            const hasPct = pct >= 0;
            const status = getStockStatus(stockActual, stockMinimo);
            const colorInfo = hasPct ? getStockColor(pct) : null;

            return (
              <Card
                key={i.id}
                className={cn(
                  "group relative overflow-hidden transition-shadow hover:shadow-md",
                  status === 'agotado' ? 'border-destructive/40' : status === 'bajo' ? 'border-yellow-400/60' : ''
                )}
              >
                {/* Barra de estado lateral */}
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    status === 'agotado' ? 'bg-destructive' : colorInfo?.bg || 'bg-muted'
                  )}
                />

                <CardContent className="p-3 pl-4">
                  {/* Header: nombre + acciones */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold truncate leading-tight" title={i.nombre}>
                        {i.nombre}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{getUnitLabel(unit)}</p>
                    </div>
                    <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 -mr-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          if (confirm(`¿Eliminar "${i.nombre}"?`)) deleteMutation.mutate(i.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Stock principal */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-bold tracking-tight">
                      {formatStock(stockActual, unit)}
                    </span>
                    {hasPct && (
                      <span className={cn("text-xs font-medium", colorInfo!.text)}>
                        {colorInfo!.label} · {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Barra de stock */}
                  {hasPct && (
                    <div className="mb-2">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", colorInfo!.bg)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Meta info compacta */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Mín: {formatStock(stockMinimo, unit)}</span>
                    {hasPct && <span>Ideal: {formatStock(stockRef, unit)}</span>}
                  </div>

                  {/* Badge de alerta */}
                  {status !== 'ok' && (
                    <div className="mt-2">
                      <Badge
                        variant={status === 'agotado' ? 'destructive' : 'outline'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {status === 'agotado' ? 'Sin stock' : 'Stock bajo'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Insumo' : 'Nuevo Insumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* SECCION: INFORMACION */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Información</h4>
              <div className="space-y-2">
                <Label className="text-sm">Nombre del insumo</Label>
                <Input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Tomate"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Unidad base</Label>
                <Select value={form.unidad_medida} onValueChange={v => setForm(f => ({ ...f, unidad_medida: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_BASE.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Todos los cálculos de stock y recetas usarán esta unidad
                </p>
              </div>
            </div>

            {/* SECCION: INVENTARIO */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventario</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Stock actual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={form.stock_actual}
                    onChange={e => setForm(f => ({ ...f, stock_actual: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stock mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={form.stock_minimo}
                    onChange={e => setForm(f => ({ ...f, stock_minimo: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stock ideal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={form.stock_inicial_referencia}
                    onChange={e => setForm(f => ({ ...f, stock_inicial_referencia: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Usado para mostrar el nivel visual del inventario. Déjalo en 0 para no mostrar porcentaje.
              </p>
            </div>

            {/* SECCION: COSTOS */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Costos</h4>
              <div className="space-y-2">
                <Label className="text-sm">Costo por {getUnitAbbr(form.unidad_medida)} (S/)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  className="h-9"
                  value={form.costo_por_unidad}
                  onChange={e => setForm(f => ({ ...f, costo_por_unidad: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.nombre}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? 'Guardar cambios' : 'Crear insumo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
