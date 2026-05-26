import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Building2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';

type Biz = {
  id: string;
  name: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  is_default: boolean;
  created_at: string;
};

export default function SuperAdmin() {
  const { isSuperAdmin, isLoading } = useSuperAdmin();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Biz | null>(null);
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [subEnd, setSubEnd] = useState('');
  const [trialEnd, setTrialEnd] = useState('');

  const { data: businesses = [], isLoading: loadingList } = useQuery({
    queryKey: ['admin-businesses'],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Biz[];
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
            <p className="text-muted-foreground">Solo super administradores pueden ver esta sección.</p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const openEdit = (b: Biz) => {
    setEditing(b);
    setPlan(b.plan);
    setStatus(b.status);
    setSubEnd(b.subscription_ends_at?.slice(0, 10) || '');
    setTrialEnd(b.trial_ends_at?.slice(0, 10) || '');
  };

  const save = async () => {
    if (!editing) return;
    const payload: any = { plan, status };
    payload.subscription_ends_at = subEnd ? new Date(subEnd).toISOString() : null;
    payload.trial_ends_at = trialEnd ? new Date(trialEnd).toISOString() : null;

    const { error } = await (supabase as any).from('businesses').update(payload).eq('id', editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await (supabase as any).from('subscription_events').insert({
      business_id: editing.id,
      event_type: 'admin_update',
      previous: { plan: editing.plan, status: editing.status, subscription_ends_at: editing.subscription_ends_at, trial_ends_at: editing.trial_ends_at },
      next: payload,
    });
    toast.success('Negocio actualizado');
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    qc.invalidateQueries({ queryKey: ['current-business'] });
  };

  const extend = async (b: Biz, days: number) => {
    const base = b.subscription_ends_at ? new Date(b.subscription_ends_at) : new Date();
    if (base.getTime() < Date.now()) base.setTime(Date.now());
    base.setDate(base.getDate() + days);
    const { error } = await (supabase as any)
      .from('businesses')
      .update({ subscription_ends_at: base.toISOString(), status: 'active' })
      .eq('id', b.id);
    if (error) return toast.error(error.message);
    await (supabase as any).from('subscription_events').insert({
      business_id: b.id,
      event_type: 'extend_subscription',
      note: `+${days} días`,
    });
    toast.success(`Vigencia extendida +${days} días`);
    qc.invalidateQueries({ queryKey: ['admin-businesses'] });
  };

  const total = businesses.length;
  const activos = businesses.filter((b) => b.status === 'active').length;
  const enTrial = businesses.filter((b) => b.plan === 'trial').length;
  const expirados = businesses.filter((b) => b.status === 'expired' || b.status === 'suspended' || b.status === 'cancelled').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-sm text-muted-foreground">Gestión de negocios y suscripciones de la plataforma</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Building2 className="h-5 w-5" />} label="Negocios" value={total} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} label="Activos" value={activos} />
          <StatCard icon={<Sparkles className="h-5 w-5 text-primary" />} label="En trial" value={enTrial} />
          <StatCard icon={<XCircle className="h-5 w-5 text-destructive" />} label="Inactivos" value={expirados} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Negocios</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((b) => {
                    const vence = b.plan === 'trial' ? b.trial_ends_at : b.subscription_ends_at;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">
                          {b.name}
                          {b.is_default && <Badge variant="secondary" className="ml-2 text-xs">default</Badge>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{b.plan}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={b.status === 'active' ? 'default' : 'destructive'}>{b.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {vence ? new Date(vence).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => extend(b, 30)}>+30d</Button>
                          <Button size="sm" onClick={() => openEdit(b)}>Editar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Plan</label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Fin de trial</label>
              <Input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Fin de suscripción</label>
              <Input type="date" value={subEnd} onChange={(e) => setSubEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
