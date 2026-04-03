import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Shield, Loader2, Search, CheckSquare, Square } from 'lucide-react';

interface RolCustom {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  es_sistema: boolean;
}

interface Modulo {
  id: string;
  clave: string;
  nombre: string;
  grupo: string | null;
  ruta: string | null;
  orden: number | null;
  activo: boolean;
}

interface RolPermiso {
  id: string;
  rol_id: string;
  modulo_id: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
  acciones_especiales: string[];
}

const grupoLabels: Record<string, string> = {
  principal: 'Principal',
  operaciones: 'Operaciones',
  catalogo: 'Catálogo',
  inventario: 'Inventario',
  reportes: 'Reportes',
  personal: 'Personal',
  sistema: 'Sistema',
  general: 'General',
};

const accionesEspecialesPorModulo: Record<string, string[]> = {
  caja: ['cerrar_caja', 'registrar_pago', 'retiro_efectivo'],
  pedidos: ['confirmar_pago', 'cancelar_orden'],
};

const accionLabel: Record<string, string> = {
  cerrar_caja: 'Cerrar caja',
  registrar_pago: 'Registrar pago',
  retiro_efectivo: 'Retiro efectivo',
  confirmar_pago: 'Confirmar pago',
  cancelar_orden: 'Cancelar orden',
};

export default function RolesCustomManager() {
  const queryClient = useQueryClient();
  const [selectedRolId, setSelectedRolId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRol, setEditingRol] = useState<RolCustom | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [searchModulo, setSearchModulo] = useState('');

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['roles-custom'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles_custom')
        .select('*')
        .order('es_sistema', { ascending: false })
        .order('nombre');
      if (error) throw error;
      return data as RolCustom[];
    },
  });

  const { data: modulos = [] } = useQuery({
    queryKey: ['modulos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos')
        .select('*')
        .eq('activo', true)
        .order('orden');
      if (error) throw error;
      return data as Modulo[];
    },
  });

  const { data: permisos = [], isLoading: loadingPermisos } = useQuery({
    queryKey: ['rol-permisos', selectedRolId],
    enabled: !!selectedRolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rol_permisos')
        .select('*')
        .eq('rol_id', selectedRolId!);
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        acciones_especiales: Array.isArray(p.acciones_especiales) 
          ? (p.acciones_especiales as string[]) 
          : [],
      })) as RolPermiso[];
    },
  });

  const saveRol = useMutation({
    mutationFn: async () => {
      if (editingRol) {
        const { error } = await supabase
          .from('roles_custom')
          .update({ nombre: formNombre, descripcion: formDescripcion || null, activo: formActivo })
          .eq('id', editingRol.id);
        if (error) throw error;
      } else {
        const { data: newRol, error } = await supabase
          .from('roles_custom')
          .insert({ nombre: formNombre, descripcion: formDescripcion || null, activo: formActivo })
          .select()
          .single();
        if (error) throw error;
        // Create default permissions (all false) for all modules
        const permsToInsert = modulos.map(m => ({
          rol_id: newRol.id,
          modulo_id: m.id,
          ver: false, crear: false, editar: false, eliminar: false,
          acciones_especiales: [] as string[],
        }));
        if (permsToInsert.length > 0) {
          const { error: permError } = await supabase.from('rol_permisos').insert(permsToInsert);
          if (permError) throw permError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-custom'] });
      toast.success(editingRol ? 'Rol actualizado' : 'Rol creado');
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRol = useMutation({
    mutationFn: async (rolId: string) => {
      const { error } = await supabase.from('roles_custom').delete().eq('id', rolId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-custom'] });
      if (selectedRolId) setSelectedRolId(null);
      toast.success('Rol eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePermiso = useMutation({
    mutationFn: async ({ permisoId, field, value }: { permisoId: string; field: string; value: boolean | string[] }) => {
      const { error } = await supabase
        .from('rol_permisos')
        .update({ [field]: value })
        .eq('id', permisoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rol-permisos', selectedRolId] });
    },
    onError: () => toast.error('Error al actualizar permiso'),
  });

  const toggleAllModule = (permiso: RolPermiso, enable: boolean) => {
    const acciones = accionesEspecialesPorModulo[
      modulos.find(m => m.id === permiso.modulo_id)?.clave || ''
    ] || [];
    
    // Update all fields at once
    supabase
      .from('rol_permisos')
      .update({
        ver: enable,
        crear: enable,
        editar: enable,
        eliminar: enable,
        acciones_especiales: enable ? acciones : [],
      })
      .eq('id', permiso.id)
      .then(({ error }) => {
        if (error) toast.error('Error');
        else queryClient.invalidateQueries({ queryKey: ['rol-permisos', selectedRolId] });
      });
  };

  const toggleAllGlobal = (enable: boolean) => {
    if (!selectedRolId) return;
    Promise.all(
      permisos.map(p => {
        const clave = modulos.find(m => m.id === p.modulo_id)?.clave || '';
        const acciones = accionesEspecialesPorModulo[clave] || [];
        return supabase
          .from('rol_permisos')
          .update({
            ver: enable, crear: enable, editar: enable, eliminar: enable,
            acciones_especiales: enable ? acciones : [],
          })
          .eq('id', p.id);
      })
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['rol-permisos', selectedRolId] });
      toast.success(enable ? 'Todos los permisos activados' : 'Todos los permisos desactivados');
    });
  };

  const openCreate = () => {
    setEditingRol(null);
    setFormNombre('');
    setFormDescripcion('');
    setFormActivo(true);
    setDialogOpen(true);
  };

  const openEdit = (rol: RolCustom) => {
    setEditingRol(rol);
    setFormNombre(rol.nombre);
    setFormDescripcion(rol.descripcion || '');
    setFormActivo(rol.activo);
    setDialogOpen(true);
  };

  const selectedRol = roles.find(r => r.id === selectedRolId);

  const filteredModulos = modulos.filter(m =>
    m.nombre.toLowerCase().includes(searchModulo.toLowerCase()) ||
    (m.grupo || '').toLowerCase().includes(searchModulo.toLowerCase())
  );

  const groupedModulos = filteredModulos.reduce<Record<string, Modulo[]>>((acc, m) => {
    const g = m.grupo || 'general';
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Roles list */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Roles del Sistema</h2>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Rol
        </Button>
      </div>

      {loadingRoles ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {roles.map(rol => (
            <Card
              key={rol.id}
              className={`cursor-pointer transition-all ${
                selectedRolId === rol.id ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedRolId(rol.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-medium">{rol.nombre}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={rol.activo ? 'default' : 'secondary'} className="text-xs">
                      {rol.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                {rol.descripcion && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{rol.descripcion}</p>
                )}
                <div className="flex items-center gap-1 mt-3">
                  {rol.es_sistema && (
                    <Badge variant="outline" className="text-xs">Sistema</Badge>
                  )}
                  <div className="flex-1" />
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={e => { e.stopPropagation(); openEdit(rol); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!rol.es_sistema && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={e => { e.stopPropagation(); deleteRol.mutate(rol.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Permissions matrix */}
      {selectedRol && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Permisos: {selectedRol.nombre}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAllGlobal(true)} className="gap-1.5">
                  <CheckSquare className="h-4 w-4" /> Activar todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAllGlobal(false)} className="gap-1.5">
                  <Square className="h-4 w-4" /> Desactivar todos
                </Button>
              </div>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar módulo..."
                value={searchModulo}
                onChange={e => setSearchModulo(e.target.value)}
                className="pl-9 max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingPermisos ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Módulo</TableHead>
                      <TableHead className="text-center w-[80px]">Ver</TableHead>
                      <TableHead className="text-center w-[80px]">Crear</TableHead>
                      <TableHead className="text-center w-[80px]">Editar</TableHead>
                      <TableHead className="text-center w-[80px]">Eliminar</TableHead>
                      <TableHead className="text-center">Acciones Especiales</TableHead>
                      <TableHead className="text-center w-[100px]">Todos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupedModulos).map(([grupo, mods]) => (
                      <>
                        <TableRow key={`group-${grupo}`} className="bg-muted/30">
                          <TableCell colSpan={7} className="py-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {grupoLabels[grupo] || grupo}
                            </span>
                          </TableCell>
                        </TableRow>
                        {mods.map(mod => {
                          const permiso = permisos.find(p => p.modulo_id === mod.id);
                          if (!permiso) return null;
                          const accEsp = accionesEspecialesPorModulo[mod.clave] || [];
                          const allEnabled = permiso.ver && permiso.crear && permiso.editar && permiso.eliminar &&
                            (accEsp.length === 0 || accEsp.every(a => permiso.acciones_especiales.includes(a)));

                          return (
                            <TableRow key={mod.id}>
                              <TableCell className="font-medium">{mod.nombre}</TableCell>
                              {(['ver', 'crear', 'editar', 'eliminar'] as const).map(field => (
                                <TableCell key={field} className="text-center">
                                  <Checkbox
                                    checked={permiso[field]}
                                    onCheckedChange={(checked) =>
                                      updatePermiso.mutate({ permisoId: permiso.id, field, value: !!checked })
                                    }
                                  />
                                </TableCell>
                              ))}
                              <TableCell>
                                {accEsp.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {accEsp.map(accion => (
                                      <label key={accion} className="flex items-center gap-1.5 text-xs">
                                        <Checkbox
                                          checked={permiso.acciones_especiales.includes(accion)}
                                          onCheckedChange={(checked) => {
                                            const newAcciones = checked
                                              ? [...permiso.acciones_especiales, accion]
                                              : permiso.acciones_especiales.filter(a => a !== accion);
                                            updatePermiso.mutate({
                                              permisoId: permiso.id,
                                              field: 'acciones_especiales',
                                              value: newAcciones,
                                            });
                                          }}
                                        />
                                        {accionLabel[accion] || accion}
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={allEnabled}
                                  onCheckedChange={(checked) => toggleAllModule(permiso, checked)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRol ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del rol *</Label>
              <Input value={formNombre} onChange={e => setFormNombre(e.target.value)} placeholder="Ej: Cajero" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formDescripcion}
                onChange={e => setFormDescripcion(e.target.value)}
                placeholder="Descripción del rol..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActivo} onCheckedChange={setFormActivo} />
              <Label>Rol activo</Label>
            </div>
            <Button
              onClick={() => {
                if (!formNombre.trim()) { toast.error('El nombre es requerido'); return; }
                saveRol.mutate();
              }}
              className="w-full"
              disabled={saveRol.isPending}
            >
              {saveRol.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : (editingRol ? 'Guardar Cambios' : 'Crear Rol')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
