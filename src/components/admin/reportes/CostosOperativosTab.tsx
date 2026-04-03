import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react';

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

export default function CostosOperativosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', categoria: 'servicios', monto: 0, periodo: 'mensual', activo: true });
  const queryClient = useQueryClient();

  const { data: costos, isLoading } = useQuery({
    queryKey: ['costos_operativos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('costos_operativos').select('*').order('categoria');
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
            <div><Label>Nombre</Label><Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Electricidad, Alquiler" /></div>
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
