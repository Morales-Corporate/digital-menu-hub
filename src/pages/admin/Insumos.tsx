import { useState } from 'react';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Package, AlertTriangle, ShoppingCart, BookOpen, Bell, BellOff, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';

const UNIDADES = [
  { value: 'unidad', label: 'Unidad(es)' },
  { value: 'gr', label: 'Gramos (gr)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'lt', label: 'Litros (lt)' },
];

// ========== INSUMOS TAB ==========
function InsumosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', unidad_medida: 'unidad', costo_por_unidad: 0, stock_actual: 0, stock_minimo: 0 });
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
    setForm({ nombre: '', unidad_medida: 'unidad', costo_por_unidad: 0, stock_actual: 0, stock_minimo: 0 });
    setDialogOpen(true);
  };

  const openEdit = (i: any) => {
    setEditingId(i.id);
    setForm({ nombre: i.nombre, unidad_medida: i.unidad_medida, costo_por_unidad: Number(i.costo_por_unidad), stock_actual: Number(i.stock_actual), stock_minimo: Number(i.stock_minimo) });
    setDialogOpen(true);
  };

  const getStockStatus = (i: any) => {
    if (Number(i.stock_actual) === 0) return 'agotado';
    if (Number(i.stock_minimo) > 0 && Number(i.stock_actual) <= Number(i.stock_minimo)) return 'bajo';
    return 'ok';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Registra los insumos y materias primas</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nuevo Insumo</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !insumos?.length ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No hay insumos registrados.</p></CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insumos.map((i: any) => {
            const status = getStockStatus(i);
            return (
              <Card key={i.id} className={status === 'agotado' ? 'border-destructive/50' : status === 'bajo' ? 'border-orange-400/50' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{i.nombre}</h3>
                      <p className="text-sm text-muted-foreground">{UNIDADES.find(u => u.value === i.unidad_medida)?.label}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar "${i.nombre}"?`)) deleteMutation.mutate(i.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Costo:</span>
                      <span className="ml-1 font-medium">S/ {Number(i.costo_por_unidad).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="ml-1 font-medium">{Number(i.stock_actual)}</span>
                    </div>
                  </div>
                  {status !== 'ok' && (
                    <Badge variant={status === 'agotado' ? 'destructive' : 'outline'} className="mt-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {status === 'agotado' ? 'Agotado' : 'Stock bajo'}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar Insumo' : 'Nuevo Insumo'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre</Label><Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Tomate" /></div>
            <div><Label>Unidad de medida</Label>
              <Select value={form.unidad_medida} onValueChange={v => setForm(f => ({ ...f, unidad_medida: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Costo por unidad (S/)</Label><Input type="number" step="0.01" value={form.costo_por_unidad} onChange={e => setForm(f => ({ ...f, costo_por_unidad: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Stock actual</Label><Input type="number" value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Stock mínimo (alerta)</Label><Input type="number" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: parseFloat(e.target.value) || 0 }))} /><p className="text-xs text-muted-foreground mt-1">Se genera alerta cuando el stock baje de este valor</p></div>
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

// ========== RECETAS TAB ==========
function RecetasTab() {
  const [selectedProducto, setSelectedProducto] = useState<string>('');
  const [addDialog, setAddDialog] = useState(false);
  const [newInsumoId, setNewInsumoId] = useState('');
  const [newCantidad, setNewCantidad] = useState(1);
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

  const { data: receta, isLoading: loadingReceta } = useQuery({
    queryKey: ['producto_insumos', selectedProducto],
    queryFn: async () => {
      if (!selectedProducto) return [];
      const { data, error } = await supabase.from('producto_insumos').select('*, insumos(*)').eq('producto_id', selectedProducto);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProducto,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('producto_insumos').insert([{ producto_id: selectedProducto, insumo_id: newInsumoId, cantidad: newCantidad }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producto_insumos', selectedProducto] });
      toast.success('Insumo agregado a la receta');
      setAddDialog(false);
      setNewInsumoId('');
      setNewCantidad(1);
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
      toast.success('Insumo removido de la receta');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const costoTotal = receta?.reduce((acc: number, r: any) => acc + (Number(r.cantidad) * Number(r.insumos?.costo_por_unidad || 0)), 0) || 0;
  const precioProducto = productos?.find((p: any) => p.id === selectedProducto)?.precio || 0;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Asigna insumos a cada producto para calcular costos y descontar inventario</p>

      <div className="max-w-sm">
        <Label>Selecciona un producto</Label>
        <Select value={selectedProducto} onValueChange={setSelectedProducto}>
          <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
          <SelectContent>
            {productos?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedProducto && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Receta / Insumos
              </CardTitle>
              <Button size="sm" onClick={() => setAddDialog(true)}><Plus className="h-4 w-4 mr-1" />Agregar insumo</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingReceta ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            ) : !receta?.length ? (
              <p className="text-muted-foreground text-sm text-center py-4">No hay insumos asignados a este producto</p>
            ) : (
              <div className="space-y-2">
                {receta.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div>
                      <span className="font-medium">{r.insumos?.nombre}</span>
                      <span className="text-muted-foreground ml-2">
                        {Number(r.cantidad)} {r.insumos?.unidad_medida}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        (S/ {(Number(r.cantidad) * Number(r.insumos?.costo_por_unidad || 0)).toFixed(2)})
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3 flex justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">Costo total insumos:</span>
                    <span className="font-semibold text-primary ml-2">S/ {costoTotal.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Precio venta:</span>
                    <span className="font-semibold ml-2">S/ {Number(precioProducto).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Margen:</span>
                    <span className="font-semibold text-accent ml-2">S/ {(Number(precioProducto) - costoTotal).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar insumo a la receta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Insumo</Label>
              <Select value={newInsumoId} onValueChange={setNewInsumoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo..." /></SelectTrigger>
                <SelectContent>{insumos?.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cantidad</Label><Input type="number" step="0.01" value={newCantidad} onChange={e => setNewCantidad(parseFloat(e.target.value) || 0)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
              <Button onClick={() => addMutation.mutate()} disabled={!newInsumoId || addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== COMPRAS TAB ==========
function ComprasTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ insumo_id: '', cantidad: 0, costo_unitario: 0, proveedor: '', nota: '' });
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

  const compraMutation = useMutation({
    mutationFn: async () => {
      const costoTotal = form.cantidad * form.costo_unitario;
      // Insert purchase record
      const { error: compraError } = await supabase.from('compras_insumos').insert([{
        insumo_id: form.insumo_id,
        cantidad: form.cantidad,
        costo_unitario: form.costo_unitario,
        costo_total: costoTotal,
        proveedor: form.proveedor || null,
        nota: form.nota || null,
      }]);
      if (compraError) throw compraError;

      // Update insumo stock and cost
      const insumo = insumos?.find((i: any) => i.id === form.insumo_id);
      if (insumo) {
        const newStock = Number(insumo.stock_actual) + form.cantidad;
        const { error: updateError } = await supabase.from('insumos').update({
          stock_actual: newStock,
          costo_por_unidad: form.costo_unitario, // Update to latest cost
        }).eq('id', form.insumo_id);
        if (updateError) throw updateError;
      }
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
        <Button onClick={() => { setForm({ insumo_id: '', cantidad: 0, costo_unitario: 0, proveedor: '', nota: '' }); setDialogOpen(true); }}>
          <ShoppingCart className="h-4 w-4 mr-2" />Registrar Compra
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      ) : !compras?.length ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No hay compras registradas.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {compras.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-medium">{(c as any).insumos?.nombre}</span>
                  <span className="text-muted-foreground ml-2">+{Number(c.cantidad)} {(c as any).insumos?.unidad_medida}</span>
                  {c.proveedor && <Badge variant="outline" className="ml-2">{c.proveedor}</Badge>}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">S/ {Number(c.costo_total).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('es-PE')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Insumo</Label>
              <Select value={form.insumo_id} onValueChange={v => setForm(f => ({ ...f, insumo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo..." /></SelectTrigger>
                <SelectContent>{insumos?.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cantidad</Label><Input type="number" step="0.01" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Costo unitario (S/)</Label><Input type="number" step="0.01" value={form.costo_unitario} onChange={e => setForm(f => ({ ...f, costo_unitario: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            {form.cantidad > 0 && form.costo_unitario > 0 && (
              <p className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">S/ {(form.cantidad * form.costo_unitario).toFixed(2)}</span></p>
            )}
            <div><Label>Proveedor (opcional)</Label><Input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} placeholder="Ej: Mercado Central" /></div>
            <div><Label>Nota (opcional)</Label><Input value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} placeholder="Ej: Compra semanal" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => compraMutation.mutate()} disabled={!form.insumo_id || form.cantidad <= 0 || compraMutation.isPending}>
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
      {/* Config */}
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

      {/* Notifications list */}
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