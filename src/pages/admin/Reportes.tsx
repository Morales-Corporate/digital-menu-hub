import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Building2 } from 'lucide-react';
import { subDays } from 'date-fns';

import DateRangeSelector from '@/components/admin/reportes/DateRangeSelector';
import ResumenCards from '@/components/admin/reportes/ResumenCards';
import DesglosePagos from '@/components/admin/reportes/DesglosePagos';
import DesgloseUtilidad from '@/components/admin/reportes/DesgloseUtilidad';
import TopProductos from '@/components/admin/reportes/TopProductos';
import TopInsumos from '@/components/admin/reportes/TopInsumos';
import CostosOperativosTab from '@/components/admin/reportes/CostosOperativosTab';

export default function Reportes() {
  const [desde, setDesde] = useState(() => { const d = subDays(new Date(), 30); d.setHours(0,0,0,0); return d; });
  const [hasta, setHasta] = useState(() => new Date());

  const desdeStr = desde.toISOString();
  const hastaStr = hasta.toISOString();
  const dias = Math.max(1, Math.ceil((hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)));

  // Órdenes entregadas en el periodo
  const { data: ordenes, isLoading } = useQuery({
    queryKey: ['reportes_ordenes', desdeStr, hastaStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordenes')
        .select('id, total, created_at, estado, metodo_pago')
        .gte('created_at', desdeStr)
        .lte('created_at', hastaStr)
        .in('estado', ['entregado']);
      if (error) throw error;
      return data;
    },
  });

  // Items de las órdenes
  const { data: ordenItems } = useQuery({
    queryKey: ['reportes_orden_items', desdeStr, hastaStr],
    queryFn: async () => {
      if (!ordenes?.length) return [];
      const ids = ordenes.map(o => o.id);
      const { data, error } = await supabase
        .from('orden_items')
        .select('producto_id, cantidad, precio_unitario')
        .in('orden_id', ids);
      if (error) throw error;
      return data;
    },
    enabled: !!ordenes?.length,
  });

  // Recetas
  const { data: recetas } = useQuery({
    queryKey: ['reportes_recetas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('producto_insumos').select('producto_id, insumo_id, cantidad, insumos(costo_por_unidad)');
      if (error) throw error;
      return data;
    },
  });

  // Productos lookup
  const { data: productosRaw } = useQuery({
    queryKey: ['reportes_productos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('productos').select('id, nombre, precio');
      if (error) throw error;
      return data;
    },
  });

  // Insumos lookup
  const { data: insumosRaw } = useQuery({
    queryKey: ['reportes_insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('id, nombre, unidad_medida, costo_por_unidad');
      if (error) throw error;
      return data;
    },
  });

  // Costos operativos activos
  const { data: costosOp } = useQuery({
    queryKey: ['costos_operativos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('costos_operativos').select('*').eq('activo', true);
      if (error) throw error;
      return data;
    },
  });

  // Lookups
  const productosMap = useMemo(() => {
    const m: Record<string, { nombre: string; precio: number }> = {};
    productosRaw?.forEach(p => { m[p.id] = { nombre: p.nombre, precio: Number(p.precio) }; });
    return m;
  }, [productosRaw]);

  const insumosMap = useMemo(() => {
    const m: Record<string, { nombre: string; unidad_medida: string; costo_por_unidad: number }> = {};
    insumosRaw?.forEach(i => { m[i.id] = { nombre: i.nombre, unidad_medida: i.unidad_medida, costo_por_unidad: Number(i.costo_por_unidad) }; });
    return m;
  }, [insumosRaw]);

  // Cálculos
  const totalVentas = ordenes?.reduce((a, o) => a + Number(o.total), 0) || 0;

  const costoInsumos = useMemo(() => {
    if (!ordenItems?.length || !recetas?.length) return 0;
    let total = 0;
    for (const item of ordenItems) {
      const recs = recetas.filter(r => r.producto_id === item.producto_id);
      for (const r of recs) {
        total += Number(r.cantidad) * item.cantidad * Number((r as any).insumos?.costo_por_unidad || 0);
      }
    }
    return total;
  }, [ordenItems, recetas]);

  const costoOpMensual = costosOp?.reduce((acc: number, c: any) => {
    const monto = Number(c.monto);
    if (c.periodo === 'mensual') return acc + monto;
    if (c.periodo === 'quincenal') return acc + monto * 2;
    if (c.periodo === 'semanal') return acc + monto * 4;
    return acc + monto;
  }, 0) || 0;
  const costoOpPeriodo = (costoOpMensual / 30) * dias;

  const utilidadBruta = totalVentas - costoInsumos;
  const utilidadNeta = utilidadBruta - costoOpPeriodo;
  const margenBruto = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0;
  const margenNeto = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">Reportes Financieros</h1>

        <Tabs defaultValue="utilidad">
          <TabsList>
            <TabsTrigger value="utilidad"><TrendingUp className="h-4 w-4 mr-2" />Utilidad</TabsTrigger>
            <TabsTrigger value="costos"><Building2 className="h-4 w-4 mr-2" />Costos Operativos</TabsTrigger>
          </TabsList>

          <TabsContent value="utilidad" className="space-y-6">
            <DateRangeSelector desde={desde} hasta={hasta} onDesdeChange={setDesde} onHastaChange={setHasta} />

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <>
                <ResumenCards
                  totalVentas={totalVentas}
                  totalOrdenes={ordenes?.length || 0}
                  costoInsumos={costoInsumos}
                  costoOperativo={costoOpPeriodo}
                  utilidadBruta={utilidadBruta}
                  utilidadNeta={utilidadNeta}
                  margenBruto={margenBruto}
                  margenNeto={margenNeto}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <DesgloseUtilidad
                    totalVentas={totalVentas}
                    costoInsumos={costoInsumos}
                    utilidadBruta={utilidadBruta}
                    margenBruto={margenBruto}
                    costosOperativos={costosOp || []}
                    costoOpTotal={costoOpPeriodo}
                    utilidadNeta={utilidadNeta}
                    margenNeto={margenNeto}
                    dias={dias}
                  />
                  <DesglosePagos ordenes={ordenes || []} />
                </div>

                <TopProductos
                  ordenItems={ordenItems || []}
                  productos={productosMap}
                  recetas={recetas || []}
                />

                <TopInsumos
                  ordenItems={ordenItems || []}
                  recetas={recetas || []}
                  insumos={insumosMap}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="costos"><CostosOperativosTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
