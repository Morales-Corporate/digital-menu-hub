import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, Plus, Trash2, UserCog } from 'lucide-react';

type AppRole = 'admin' | 'mesero' | 'cocina' | 'user';

interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  profiles: { email: string | null; full_name: string | null } | null;
}

const rolLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  mesero: 'Mesero',
  cocina: 'Cocina',
  user: 'Usuario',
};

const rolColors: Record<AppRole, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  mesero: 'bg-blue-500/10 text-blue-700 border-blue-200',
  cocina: 'bg-orange-500/10 text-orange-700 border-orange-200',
  user: 'bg-muted text-muted-foreground border-border',
};

export default function Roles() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('mesero');

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['user-roles-admin'],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role')
        .order('role');
      if (rolesError) throw rolesError;
      if (!rolesData || rolesData.length === 0) return [];

      const userIds = [...new Set(rolesData.map(r => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, { email: p.email, full_name: p.full_name }])
      );

      return rolesData.map(r => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null,
      })) as UserRoleRow[];
    },
  });

  const assignRole = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('No se encontró un usuario con ese email. Asegúrate de que el usuario se haya registrado.');

      // Check if role already exists
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.id)
        .eq('role', role)
        .maybeSingle();

      if (existing) throw new Error('Este usuario ya tiene asignado ese rol.');

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: profile.id, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-admin'] });
      toast.success('Rol asignado correctamente');
      setEmail('');
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-admin'] });
      toast.success('Rol eliminado');
    },
    onError: () => toast.error('Error al eliminar rol'),
  });

  const handleAssign = () => {
    if (!email.trim()) {
      toast.error('Ingresa un email');
      return;
    }
    assignRole.mutate({ email: email.trim(), role: selectedRole });
  };

  // Group roles by user
  const groupedByUser = roles.reduce<Record<string, UserRoleRow[]>>((acc, r) => {
    const key = r.user_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Roles y Permisos</h1>
            <p className="text-muted-foreground mt-1">Asigna roles a los usuarios del sistema</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Asignar Rol
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Asignar Rol a Usuario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email del usuario</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    El usuario debe haberse registrado previamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={selectedRole} onValueChange={v => setSelectedRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador — Acceso total</SelectItem>
                      <SelectItem value="mesero">Mesero — Gestión de pedidos</SelectItem>
                      <SelectItem value="cocina">Cocina — Pantalla de cocina</SelectItem>
                      <SelectItem value="user">Usuario — Cliente estándar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAssign}
                  className="w-full"
                  disabled={assignRole.isPending}
                >
                  {assignRole.isPending ? 'Asignando...' : 'Asignar Rol'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Role legend */}
        <div className="flex flex-wrap gap-3">
          {(['admin', 'mesero', 'cocina', 'user'] as AppRole[]).map(role => (
            <div key={role} className={`px-3 py-1.5 rounded-md border text-sm ${rolColors[role]}`}>
              <span className="font-medium">{rolLabels[role]}</span>
              <span className="ml-2 opacity-70">
                {role === 'admin' && '— Acceso completo'}
                {role === 'mesero' && '— Pedidos y mesas'}
                {role === 'cocina' && '— Pantalla de cocina'}
                {role === 'user' && '— Cliente'}
              </span>
            </div>
          ))}
        </div>

        {/* Users list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Usuarios con roles ({Object.keys(groupedByUser).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Cargando...</p>
            ) : Object.keys(groupedByUser).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay roles asignados. Usa el botón "Asignar Rol" para comenzar.
              </p>
            ) : (
              <div className="divide-y">
                {Object.entries(groupedByUser).map(([userId, userRoles]) => {
                  const profile = userRoles[0]?.profiles;
                  return (
                    <div key={userId} className="flex items-center justify-between py-3 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                          {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {profile?.full_name && (
                            <p className="font-medium truncate">{profile.full_name}</p>
                          )}
                          <p className="text-sm text-muted-foreground truncate">
                            {profile?.email || 'Sin email'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {userRoles.map(ur => (
                          <div key={ur.id} className="flex items-center gap-1">
                            <Badge variant="outline" className={rolColors[ur.role]}>
                              {rolLabels[ur.role]}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive/60 hover:text-destructive"
                              onClick={() => removeRole.mutate(ur.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
