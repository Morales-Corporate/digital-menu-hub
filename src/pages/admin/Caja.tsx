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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DollarSign,
  Plus,
  Minus,
  RefreshCw,
  QrCode,
  Banknote,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  LockOpen,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfDay, endOfDay, isBefore, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface AperturaCaja {
  id: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial: number;
  estado: string;
  tipo_apertura: string;
  tipo_cierre: string | null;
  observacion: string | null;
  total_ventas: number;
  total_efectivo: number;
  total_yape_plin: number;
  total_tarjeta: number;
  total_retiros: number;
  ordenes_entregadas: number;
  ordenes_canceladas: number;
  efectivo_esperado: number;
  efectivo_real: number | null;
  diferencia: number | null;
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
  total: number;
  estado: string;
  metodo_pago: string;
}

export default function Caja() {
  const [cajaAbierta, setCajaAbierta] = useState<AperturaCaja | null>(null);
  const [historialAperturas, setHistorialAperturas] = useState<AperturaCaja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showAbrirDialog, setShowAbrirDialog] = useState(false);
  const [showCerrarDialog, setShowCerrarDialog] = useState(false);
  const [showMovimientoDialog, setShowMovimientoDialog] = useState(false);
  const [showRecuperacionDialog, setShowRecuperacionDialog] = useState(false);

  // Abrir caja form
  const [montoInicial, setMontoInicial] = useState('');

  // Cerrar caja form
  const [efectivoReal, setEfectivoReal] = useState('');
  const [loadingCierre, setLoadingCierre] = useState(false);
  const [ordersCierre, setOrdersCierre] = useState<OrderForCierre[]>([]);
  const [movimientosCierre, setMovimientosCierre] = useState<MovimientoCaja[]>([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<{id: string; estado: string; numero_mesa: number | null; nombre_invitado: string | null; total: number}[]>([]);
  const [cancelandoPendientes, setCancelandoPendientes] = useState(false);

  // Movimiento form
  const [movimientoTipo, setMovimientoTipo] = useState<'retiro' | 'ingreso'>('retiro');
  const [movimientoMonto, setMovimientoMonto] = useState('');
  const [movimientoMotivo, setMovimientoMotivo] = useState('');

  // Recovery
  const [cajaAnterior, setCajaAnterior] = useState<AperturaCaja | null>(null);
  const [montoManualRecuperacion, setMontoManualRecuperacion] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aperturaResult, historialResult, movResult] = await Promise.all([
        supabase
          .from('aperturas_caja')
          .select('*')
          .eq('estado', 'abierta')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('aperturas_caja')
          .select('*')
          .order('fecha_apertura', { ascending: false })
          .limit(20),
        supabase
          .from('movimientos_caja')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (aperturaResult.error) throw aperturaResult.error;
      if (historialResult.error) throw historialResult.error;
      if (movResult.error) throw movResult.error;

      const abierta = aperturaResult.data as AperturaCaja | null;
      setCajaAbierta(abierta);
      setHistorialAperturas((historialResult.data || []) as AperturaCaja[]);
      setMovimientos(movResult.data || []);

      // Check recovery mode
      if (abierta) {
        const aperturDate = new Date(abierta.fecha_apertura);
        if (isBefore(aperturDate, startOfToday())) {
          setCajaAnterior(abierta);
          setShowRecuperacionDialog(true);
        }
      }
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

  // Get today's data for the open session
  const fetchCierreData = async () => {
    if (!cajaAbierta) return;
    setLoadingCierre(true);
    try {
      const apertura = new Date(cajaAbierta.fecha_apertura).toISOString();
      const ahora = new Date().toISOString();

      const [ordResult, movResult] = await Promise.all([
        supabase
          .from('ordenes')
          .select('id, total, estado, metodo_pago')
          .gte('created_at', apertura)
          .lte('created_at', ahora)
          .in('estado', ['entregado', 'cancelado']),
        supabase
          .from('movimientos_caja')
          .select('*')
          .gte('created_at', apertura)
          .lte('created_at', ahora),
      ]);

      if (ordResult.error) throw ordResult.error;
      if (movResult.error) throw movResult.error;

      setOrdersCierre(ordResult.data || []);
      setMovimientosCierre(movResult.data || []);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error al cargar resumen');
    } finally {
      setLoadingCierre(false);
    }
  };

  useEffect(() => {
    if (showCerrarDialog) {
      fetchCierreData();
    }
  }, [showCerrarDialog]);

  // ---- ABRIR CAJA ----
  const handleAbrirCaja = async () => {
    const monto = parseFloat(montoInicial);
    if (isNaN(monto) || monto < 0) {
      toast.error('Ingresa un monto inicial válido');
      return;
    }

    try {
      const { error } = await supabase
        .from('aperturas_caja')
        .insert({
          monto_inicial: monto,
          estado: 'abierta',
          tipo_apertura: 'normal',
        });

      if (error) throw error;

      toast.success('Caja abierta correctamente');
      setShowAbrirDialog(false);
      setMontoInicial('');
      fetchData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error al abrir caja');
    }
  };

  // ---- CERRAR CAJA ----
  const handleCerrarCaja = async (tipoCierre = 'normal', observacion?: string, montoManual?: number) => {
    const cajaTarget = tipoCierre === 'manual' ? cajaAnterior : cajaAbierta;
    if (!cajaTarget) return;

    const entregados = ordersCierre.filter(o => o.estado === 'entregado');
    const cancelados = ordersCierre.filter(o => o.estado === 'cancelado');

    const totalVentas = entregados.reduce((s, o) => s + o.total, 0);
    const totalEfectivo = entregados.filter(o => o.metodo_pago === 'efectivo').reduce((s, o) => s + o.total, 0);
    const totalYapePlin = entregados.filter(o => o.metodo_pago === 'yape_plin').reduce((s, o) => s + o.total, 0);
    const totalTarjeta = entregados.filter(o => o.metodo_pago === 'tarjeta').reduce((s, o) => s + o.total, 0);
    const totalRetiros = movimientosCierre.filter(m => m.tipo === 'retiro').reduce((s, m) => s + m.monto, 0);
    const totalIngresos = movimientosCierre.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);

    const efectivoEsperado = cajaTarget.monto_inicial + totalEfectivo + totalIngresos - totalRetiros;
    const realEfectivo = montoManual !== undefined ? montoManual : parseFloat(efectivoReal);

    if (isNaN(realEfectivo)) {
      toast.error('Ingresa el efectivo real en caja');
      return;
    }

    try {
      const { error } = await supabase
        .from('aperturas_caja')
        .update({
          fecha_cierre: new Date().toISOString(),
          estado: 'cerrada',
          tipo_cierre: tipoCierre,
          observacion: observacion || null,
          total_ventas: totalVentas,
          total_efectivo: totalEfectivo,
          total_yape_plin: totalYapePlin,
          total_tarjeta: totalTarjeta,
          total_retiros: totalRetiros,
          ordenes_entregadas: entregados.length,
          ordenes_canceladas: cancelados.length,
          efectivo_esperado: efectivoEsperado,
          efectivo_real: realEfectivo,
          diferencia: realEfectivo - efectivoEsperado,
        })
        .eq('id', cajaTarget.id);

      if (error) throw error;

      toast.success('Caja cerrada correctamente');
      setShowCerrarDialog(false);
      setShowRecuperacionDialog(false);
      setEfectivoReal('');
      setCajaAnterior(null);
      fetchData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error al cerrar caja');
    }
  };

  // ---- MOVIMIENTO ----
  const handleAddMovimiento = async () => {
    if (!movimientoMonto || !movimientoMotivo.trim()) {
      toast.error('Completa todos los campos');
      return;
    }
    if (!cajaAbierta) {
      toast.error('Debes abrir caja antes de registrar movimientos');
      return;
    }

    try {
      const { error } = await supabase
        .from('movimientos_caja')
        .insert({
          fecha: format(new Date(), 'yyyy-MM-dd'),
          tipo: movimientoTipo,
          monto: parseFloat(movimientoMonto),
          motivo: movimientoMotivo.trim(),
        });

      if (error) throw error;

      toast.success(`${movimientoTipo === 'retiro' ? 'Retiro' : 'Ingreso'} registrado`);
      setShowMovimientoDialog(false);
      setMovimientoMonto('');
      setMovimientoMotivo('');
      fetchData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error al registrar movimiento');
    }
  };

  // --- Calculations for current session ---
  const sessionMovimientos = cajaAbierta
    ? movimientos.filter(m => new Date(m.created_at) >= new Date(cajaAbierta.fecha_apertura))
    : [];

  const sessionTotalRetiros = sessionMovimientos.filter(m => m.tipo === 'retiro').reduce((s, m) => s + m.monto, 0);
  const sessionTotalIngresos = sessionMovimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);

  // For summary cards when caja is open, we show today's approximate data
  // We don't have live order totals without querying, so show 0 or from history
  const displayTotalVentas = cajaAbierta ? 0 : 0;
  const displayTotalRetiros = cajaAbierta ? sessionTotalRetiros : 0;
  const displayMonto = cajaAbierta ? cajaAbierta.monto_inicial : 0;
  const displayEfectivo = cajaAbierta ? (cajaAbierta.monto_inicial + sessionTotalIngresos - sessionTotalRetiros) : 0;

  // Cierre dialog calculations
  const cierreEntregados = ordersCierre.filter(o => o.estado === 'entregado');
  const cierreCancelados = ordersCierre.filter(o => o.estado === 'cancelado');
  const cierreTotalVentas = cierreEntregados.reduce((s, o) => s + o.total, 0);
  const cierreTotalEfectivo = cierreEntregados.filter(o => o.metodo_pago === 'efectivo').reduce((s, o) => s + o.total, 0);
  const cierreTotalYape = cierreEntregados.filter(o => o.metodo_pago === 'yape_plin').reduce((s, o) => s + o.total, 0);
  const cierreTotalTarjeta = cierreEntregados.filter(o => o.metodo_pago === 'tarjeta').reduce((s, o) => s + o.total, 0);
  const cierreRetiros = movimientosCierre.filter(m => m.tipo === 'retiro').reduce((s, m) => s + m.monto, 0);
  const cierreIngresos = movimientosCierre.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const cierreEfectivoEsperado = cajaAbierta
    ? cajaAbierta.monto_inicial + cierreTotalEfectivo + cierreIngresos - cierreRetiros
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Caja</h1>
            {cajaAbierta ? (
              <Badge className="bg-green-600 text-white gap-1.5 text-sm px-3 py-1">
                <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
                Caja abierta
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5 text-sm px-3 py-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                Caja cerrada
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (!cajaAbierta) {
                  toast.error('Debes abrir caja antes de registrar movimientos');
                  return;
                }
                setShowMovimientoDialog(true);
              }}
              variant="outline"
              disabled={!cajaAbierta}
            >
              <Plus className="h-4 w-4 mr-2" />
              Movimiento
            </Button>

            {cajaAbierta ? (
              <Button onClick={() => setShowCerrarDialog(true)} variant="destructive">
                <Lock className="h-4 w-4 mr-2" />
                Cerrar Caja
              </Button>
            ) : (
              <Button onClick={() => setShowAbrirDialog(true)}>
                <LockOpen className="h-4 w-4 mr-2" />
                Abrir Caja
              </Button>
            )}

            <Button variant="ghost" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Alerta caja cerrada */}
        {!cajaAbierta && !loading && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Caja cerrada</AlertTitle>
            <AlertDescription>
              Debes abrir caja antes de registrar ventas o movimientos.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monto Inicial</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">S/ {displayMonto.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {cajaAbierta
                  ? `Abierta ${format(new Date(cajaAbierta.fecha_apertura), 'HH:mm', { locale: es })}`
                  : 'Sin apertura'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Retiros</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">S/ {displayTotalRetiros.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {sessionMovimientos.filter(m => m.tipo === 'retiro').length} retiros hoy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Extra</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">S/ {sessionTotalIngresos.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {sessionMovimientos.filter(m => m.tipo === 'ingreso').length} ingresos hoy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efectivo en Caja</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${displayEfectivo >= 0 ? 'text-primary' : 'text-red-600'}`}>
                S/ {displayEfectivo.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Inicial + Ingresos - Retiros</p>
            </CardContent>
          </Card>
        </div>

        {/* Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Historial aperturas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Historial de Caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historialAperturas.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No hay registros</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total Ventas</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historialAperturas.map(ap => (
                      <TableRow key={ap.id}>
                        <TableCell className="text-sm">
                          {format(new Date(ap.fecha_apertura), 'dd/MM HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>
                          {ap.estado === 'abierta' ? (
                            <Badge className="bg-green-600 text-white">Abierta</Badge>
                          ) : (
                            <Badge variant="secondary">Cerrada</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          S/ {ap.total_ventas.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${
                          ap.diferencia !== null
                            ? ap.diferencia >= 0 ? 'text-green-600' : 'text-red-600'
                            : ''
                        }`}>
                          {ap.diferencia !== null ? `S/ ${ap.diferencia.toFixed(2)}` : '—'}
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

        {/* ===== DIALOG: Abrir Caja ===== */}
        <Dialog open={showAbrirDialog} onOpenChange={setShowAbrirDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LockOpen className="h-5 w-5 text-green-600" />
                Abrir Caja
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>Fecha:</strong> {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</p>
              </div>
              <div className="space-y-2">
                <Label>Monto inicial en efectivo (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAbrirDialog(false)}>Cancelar</Button>
              <Button onClick={handleAbrirCaja} disabled={!montoInicial || parseFloat(montoInicial) < 0}>
                <LockOpen className="h-4 w-4 mr-2" />
                Confirmar Apertura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== DIALOG: Cerrar Caja ===== */}
        <Dialog open={showCerrarDialog} onOpenChange={setShowCerrarDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-600" />
                Cerrar Caja
              </DialogTitle>
            </DialogHeader>
            {loadingCierre ? (
              <p className="text-center py-4 text-muted-foreground">Cargando resumen...</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-muted-foreground">Pedidos entregados</p>
                    <p className="text-xl font-bold text-green-600">{cierreEntregados.length}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-muted-foreground">Pedidos cancelados</p>
                    <p className="text-xl font-bold text-red-600">{cierreCancelados.length}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total ventas</span>
                    <span className="font-bold">S/ {cierreTotalVentas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> Efectivo</span>
                    <span>S/ {cierreTotalEfectivo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><QrCode className="h-3 w-3" /> Yape/Plin</span>
                    <span>S/ {cierreTotalYape.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Tarjeta</span>
                    <span>S/ {cierreTotalTarjeta.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monto inicial</span>
                    <span>S/ {cajaAbierta?.monto_inicial.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Ingresos extra</span>
                    <span>S/ {cierreIngresos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>- Retiros</span>
                    <span>S/ {cierreRetiros.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Efectivo esperado</span>
                    <span>S/ {cierreEfectivoEsperado.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Efectivo real en caja (S/)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={efectivoReal}
                    onChange={(e) => setEfectivoReal(e.target.value)}
                    autoFocus
                  />
                  {efectivoReal && (
                    <p className={`text-sm font-medium ${
                      parseFloat(efectivoReal) - cierreEfectivoEsperado >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Diferencia: S/ {(parseFloat(efectivoReal) - cierreEfectivoEsperado).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCerrarDialog(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => handleCerrarCaja('normal')}
                disabled={loadingCierre || !efectivoReal}
              >
                <Lock className="h-4 w-4 mr-2" />
                Confirmar Cierre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== DIALOG: Recuperación ===== */}
        <Dialog open={showRecuperacionDialog} onOpenChange={setShowRecuperacionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Caja abierta del día anterior
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tienes una caja abierta desde el{' '}
                <strong>
                  {cajaAnterior && format(new Date(cajaAnterior.fecha_apertura), "dd/MM/yyyy HH:mm", { locale: es })}
                </strong>
                . Debes cerrarla antes de continuar.
              </p>

              <div className="space-y-2">
                <Label>Efectivo real al momento del cierre (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={montoManualRecuperacion}
                  onChange={(e) => setMontoManualRecuperacion(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowRecuperacionDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const monto = parseFloat(montoManualRecuperacion);
                  if (isNaN(monto)) {
                    toast.error('Ingresa el monto');
                    return;
                  }
                  handleCerrarCaja('manual', 'cierre fuera de tiempo', monto);
                }}
                disabled={!montoManualRecuperacion}
              >
                Cerrar con monto manual
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== DIALOG: Movimiento ===== */}
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
                    ? 'Ej: Compra de insumos, mercadería...'
                    : 'Ej: Aporte de capital, devolución...'}
                  value={movimientoMotivo}
                  onChange={(e) => setMovimientoMotivo(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMovimientoDialog(false)}>Cancelar</Button>
              <Button onClick={handleAddMovimiento} disabled={!movimientoMonto || !movimientoMotivo.trim()}>
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
