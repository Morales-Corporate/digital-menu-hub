import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  ordenItems: any[];
  productos: Record<string, { nombre: string; precio: number }>;
  recetas: any[];
}

export default function TopProductos({ ordenItems, productos, recetas }: Props) {
  // Aggregate by product
  const porProducto: Record<string, { cantidad: number; ingreso: number }> = {};
  for (const item of ordenItems) {
    const pid = item.producto_id;
    if (!pid) continue;
    if (!porProducto[pid]) porProducto[pid] = { cantidad: 0, ingreso: 0 };
    porProducto[pid].cantidad += item.cantidad;
    porProducto[pid].ingreso += item.cantidad * Number(item.precio_unitario);
  }

  // Calculate cost per product from recipes
  const costoPorProducto: Record<string, number> = {};
  for (const r of recetas) {
    if (!costoPorProducto[r.producto_id]) costoPorProducto[r.producto_id] = 0;
    costoPorProducto[r.producto_id] += Number(r.cantidad) * Number((r as any).insumos?.costo_por_unidad || 0);
  }

  const sorted = Object.entries(porProducto)
    .map(([pid, data]) => {
      const prod = productos[pid];
      const costoUnit = costoPorProducto[pid] || 0;
      const costoTotal = costoUnit * data.cantidad;
      const utilidad = data.ingreso - costoTotal;
      const margen = data.ingreso > 0 ? (utilidad / data.ingreso) * 100 : 0;
      return {
        id: pid,
        nombre: prod?.nombre || 'Desconocido',
        cantidad: data.cantidad,
        ingreso: data.ingreso,
        costoUnit,
        costoTotal,
        utilidad,
        margen,
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad);

  const topVendidos = sorted.slice(0, 10);
  const topRentables = [...sorted].sort((a, b) => b.utilidad - a.utilidad).slice(0, 10);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-lg">🔥 Productos más vendidos</CardTitle></CardHeader>
        <CardContent>
          {!topVendidos.length ? (
            <p className="text-muted-foreground text-sm">Sin datos en este periodo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVendidos.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-6 justify-center">{i + 1}</Badge>
                        {p.nombre}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{p.cantidad}</TableCell>
                    <TableCell className="text-right font-medium">S/ {p.ingreso.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">💰 Productos más rentables</CardTitle></CardHeader>
        <CardContent>
          {!topRentables.length ? (
            <p className="text-muted-foreground text-sm">Sin datos en este periodo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Utilidad</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRentables.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-6 justify-center">{i + 1}</Badge>
                        {p.nombre}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${p.utilidad >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      S/ {p.utilidad.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={p.margen >= 50 ? 'default' : p.margen >= 30 ? 'secondary' : 'destructive'}>
                        {p.margen.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
