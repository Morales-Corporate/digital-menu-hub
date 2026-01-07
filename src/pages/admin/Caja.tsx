import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Plus, 
  Minus, 
  Calendar, 
  RefreshCw,
  QrCode,
  Banknote,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface CierreCaja {
  id: string;
  fecha: string;
  total_ventas: number;
  total_efectivo: number;
  total_yape_plin: number;
  total_tarjeta: number;
  ordenes_entregadas: number;
  ordenes_canceladas: number;
  created_at: string;
}

interface MovimientoCaja {
  id: string;
  fecha: string;
  tipo: string;
  monto: number;
  motivo: string;
  created_at: string;
}

interface OrderForCierre {
  id: string;
  created_at: string;
  total: number;
  estado: string;
  metodo_pago: string;
}

export default function Caja() {
  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCierreDialog, setShowCierreDialog] = useState(false);
  const [showMovimientoDialog, setShowMovimientoDialog] = useState(false);
  const [cierreDate, setCierreDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [pendingOrders, setPendingOrders] = useState<OrderForCierre[]>([]);
  const [loadingCierre, setLoadingCierre] = useState(false);
  
  // Movimiento form
  const [movimientoFecha, setMovimientoFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [movimientoTipo, setMovimientoTipo] = useState<'retiro' | 'ingreso'>('retiro');
  const [movimientoMonto, setMovimientoMonto] = useState('');
  const [movimientoMotivo, setMovimientoMotivo] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cierresResult, movimientosResult] = await Promise.all([
        supabase
          .from('cierres_caja')
          .select('*')
          .order('fecha', { ascending: false }),
        supabase
          .from('movimientos_caja')
          .select('*')
          .order('fecha', { ascending: false })
      ]);

      if (cierresResult.error) throw cierresResult.error;
      if (movimientosResult.error) throw movimientosResult.error;

      setCierres(cierresResult.data || []);
      setMovimientos(movimientosResult.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos de caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchOrdersForCierre = async () => {
    setLoadingCierre(true);
    try {
      const selectedDate = parseISO(cierreDate);
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();

      // Check if cierre already exists for this date
      const existingCierre = cierres.find(c => c.fecha === cierreDate);
      if (existingCierre) {
        toast.error('Ya existe un cierre de caja para esta fecha');
        setLoadingCierre(false);
        return;
      }

      const { data, error } = await supabase
        .from('ordenes')
        .select('id, created_at, total, estado, metodo_pago')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .in('estado', ['entregado', 'cancelado']);

      if (error) throw error;
      setPendingOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Error al cargar pedidos del día');
    } finally {
      setLoadingCierre(false);
    }
  };

  useEffect(() => {
    if (showCierreDialog) {
      fetchOrdersForCierre();
    }
  }, [showCierreDialog, cierreDate]);

  const handleConfirmCierre = async () => {
    try {
      const entregados = pendingOrders.filter(o => o.estado === 'entregado');
      const cancelados = pendingOrders.filter(o => o.estado === 'cancelado');

      const totales = {
        total_ventas: entregados.reduce((sum, o) => sum + o.total, 0),
        total_efectivo: entregados.filter(o => o.metodo_pago === 'efectivo').reduce((sum, o) => sum + o.total, 0),
        total_yape_plin: entregados.filter(o => o.metodo_pago === 'yape_plin').reduce((sum, o) => sum + o.total, 0),
        total_tarjeta: entregados.filter(o => o.metodo_pago === 'tarjeta').reduce((sum, o) => sum + o.total, 0),
        ordenes_entregadas: entregados.length,
        ordenes_canceladas: cancelados.length,
      };

      const { error } = await supabase
        .from('cierres_caja')
        .insert({
          fecha: cierreDate,
          ...totales
        });

      if (error) throw error;

      toast.success('Cierre de caja registrado correctamente');
      setShowCierreDialog(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating cierre:', error);
      toast.error('Error al registrar cierre de caja');
    }
  };

  const handleAddMovimiento = async () => {
    if (!movimientoMonto || !movimientoMotivo.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      const { error } = await supabase
        .from('movimientos_caja')
        .insert({
          fecha: movimientoFecha,
          tipo: movimientoTipo,
          monto: parseFloat(movimientoMonto),
          motivo: movimientoMotivo.trim()
        });

      if (error) throw error;

      toast.success(`${movimientoTipo === 'retiro' ? 'Retiro' : 'Ingreso'} registrado`);
      setShowMovimientoDialog(false);
      setMovimientoMonto('');
      setMovimientoMotivo('');
      fetchData();
    } catch (error: any) {
      console.error('Error creating movimiento:', error);
      toast.error('Error al registrar movimiento');
    }
  };

  // Calculate accumulated balance
  const calculateSaldoAcumulado = () => {
    const totalIngresos = cierres.reduce((sum, c) => sum + c.total_ventas, 0);
    const totalRetiros = movimientos
      .filter(m => m.tipo === 'retiro')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalIngresosExtra = movimientos
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0);
    
    return totalIngresos + totalIngresosExtra - totalRetiros;
  };

  // Calculate totals by payment method
  const totalPorMetodo = {
    efectivo: cierres.reduce((sum, c) => sum + c.total_efectivo, 0),
    yape_plin: cierres.reduce((sum, c) => sum + c.total_yape_plin, 0),
    tarjeta: cierres.reduce((sum, c) => sum + c.total_tarjeta, 0),
  };

  const totalVentas = cierres.reduce((sum, c) => sum + c.total_ventas, 0);
  const totalRetiros = movimientos.filter(m => m.tipo === 'retiro').reduce((sum, m) => sum + m.monto, 0);
  const saldoActual = calculateSaldoAcumulado();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Caja</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowMovimientoDialog(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Movimiento
            </Button>
            <Button onClick={() => setShowCierreDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Nuevo Cierre
            </Button>
            <Button variant="ghost" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">S/ {totalVentas.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{cierres.length} cierres registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Retiros</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">S/ {totalRetiros.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {movimientos.filter(m => m.tipo === 'retiro').length} retiros
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${saldoActual >= 0 ? 'text-primary' : 'text-red-600'}`}>
                S/ {saldoActual.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Ingresos - Egresos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efectivo Acumulado</CardTitle>
              <Banknote className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">S/ {(totalPorMetodo.efectivo - totalRetiros).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Después de retiros</p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown by payment method */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose por Método de Pago</CardTitle>
            <CardDescription>Totales acumulados de todos los cierres</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <QrCode className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium">Yape/Plin</p>
                    <p className="text-xs text-muted-foreground">Pagos digitales</p>
                  </div>
                </div>
                <span className="text-xl font-bold">S/ {totalPorMetodo.yape_plin.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Banknote className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium">Efectivo</p>
                    <p className="text-xs text-muted-foreground">Dinero en caja</p>
                  </div>
                </div>
                <span className="text-xl font-bold">S/ {totalPorMetodo.efectivo.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-medium">Tarjeta (POS)</p>
                    <p className="text-xs text-muted-foreground">Por depositar</p>
                  </div>
                </div>
                <span className="text-xl font-bold">S/ {totalPorMetodo.tarjeta.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent movements */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Cierres de caja */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Cierres de Caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cierres.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No hay cierres registrados</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cierres.slice(0, 10).map(cierre => (
                      <TableRow key={cierre.id}>
                        <TableCell>
                          {format(parseISO(cierre.fecha), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              {cierre.ordenes_entregadas} ✓
                            </Badge>
                            {cierre.ordenes_canceladas > 0 && (
                              <Badge variant="outline" className="bg-red-100 text-red-800">
                                {cierre.ordenes_canceladas} ✗
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          S/ {cierre.total_ventas.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Movimientos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownCircle className="h-5 w-5 text-orange-600" />
                Movimientos de Caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No hay movimientos registrados</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.slice(0, 10).map(mov => (
                      <TableRow key={mov.id}>
                        <TableCell>
                          {format(parseISO(mov.fecha), 'dd/MM', { locale: es })}
                        </TableCell>
                        <TableCell>
                          {mov.tipo === 'retiro' ? (
                            <Badge variant="outline" className="bg-red-100 text-red-800">
                              <Minus className="h-3 w-3 mr-1" /> Retiro
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              <Plus className="h-3 w-3 mr-1" /> Ingreso
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={mov.motivo}>
                          {mov.motivo}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${mov.tipo === 'retiro' ? 'text-red-600' : 'text-green-600'}`}>
                          {mov.tipo === 'retiro' ? '-' : '+'} S/ {mov.monto.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cierre Dialog */}
        <Dialog open={showCierreDialog} onOpenChange={setShowCierreDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Nuevo Cierre de Caja
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={cierreDate}
                  onChange={(e) => setCierreDate(e.target.value)}
                  className="w-auto"
                />
              </div>

              <Separator />

              {loadingCierre ? (
                <p className="text-center py-4 text-muted-foreground">Cargando pedidos...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Entregados</p>
                      <p className="text-xl font-bold text-green-600">
                        {pendingOrders.filter(o => o.estado === 'entregado').length} pedidos
                      </p>
                      <p className="text-lg font-medium">
                        S/ {pendingOrders.filter(o => o.estado === 'entregado').reduce((s, o) => s + o.total, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Cancelados</p>
                      <p className="text-xl font-bold text-red-600">
                        {pendingOrders.filter(o => o.estado === 'cancelado').length} pedidos
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium mb-2">Por Método de Pago</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-muted/50 rounded">
                        <span className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-primary" /> Yape/Plin
                        </span>
                        <span className="font-medium">
                          S/ {pendingOrders.filter(o => o.estado === 'entregado' && o.metodo_pago === 'yape_plin').reduce((s, o) => s + o.total, 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/50 rounded">
                        <span className="flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-green-600" /> Efectivo
                        </span>
                        <span className="font-medium">
                          S/ {pendingOrders.filter(o => o.estado === 'entregado' && o.metodo_pago === 'efectivo').reduce((s, o) => s + o.total, 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/50 rounded">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-blue-600" /> Tarjeta
                        </span>
                        <span className="font-medium">
                          S/ {pendingOrders.filter(o => o.estado === 'entregado' && o.metodo_pago === 'tarjeta').reduce((s, o) => s + o.total, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCierreDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmCierre}
                disabled={loadingCierre || pendingOrders.filter(o => o.estado === 'entregado').length === 0}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Cierre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Movimiento Dialog */}
        <Dialog open={showMovimientoDialog} onOpenChange={setShowMovimientoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {movimientoTipo === 'retiro' ? (
                  <ArrowDownCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                )}
                Registrar Movimiento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={movimientoTipo === 'retiro' ? 'default' : 'outline'}
                  onClick={() => setMovimientoTipo('retiro')}
                  className="flex-1"
                >
                  <Minus className="h-4 w-4 mr-2" /> Retiro
                </Button>
                <Button
                  variant={movimientoTipo === 'ingreso' ? 'default' : 'outline'}
                  onClick={() => setMovimientoTipo('ingreso')}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" /> Ingreso
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={movimientoFecha}
                  onChange={(e) => setMovimientoFecha(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Monto (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={movimientoMonto}
                  onChange={(e) => setMovimientoMonto(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Textarea
                  placeholder={movimientoTipo === 'retiro' 
                    ? 'Ej: Compra de insumos, mercadería, etc.'
                    : 'Ej: Aporte de capital, devolución, etc.'}
                  value={movimientoMotivo}
                  onChange={(e) => setMovimientoMotivo(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMovimientoDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddMovimiento}
                disabled={!movimientoMonto || !movimientoMotivo.trim()}
              >
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}