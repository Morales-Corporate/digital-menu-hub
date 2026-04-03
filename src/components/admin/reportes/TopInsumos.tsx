import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const UNIT_LABELS: Record<string, string> = { g: 'g', ml: 'ml', unidad: 'und' };

function formatQty(val: number, unit: string) {
  if (unit === 'g' && val >= 1000) return `${(val / 1000).toFixed(2)} kg`;
  if (unit === 'ml' && val >= 1000) return `${(val / 1000).toFixed(2)} lt`;
  return `${val % 1 === 0 ? val : val.toFixed(2)} ${UNIT_LABELS[unit] || unit}`;
}

interface Props {
  ordenItems: any[];
  recetas: any[];
  insumos: Record<string, { nombre: string; unidad_medida: string; costo_por_unidad: number }>;
}

export default function TopInsumos({ ordenItems, recetas, insumos }: Props) {
  const consumo: Record<string, { cantidad: number; costo: number }> = {};

  for (const item of ordenItems) {
    const recetasP = recetas.filter(r => r.producto_id === item.producto_id);
    for (const r of recetasP) {
      const iid = r.insumo_id;
      if (!consumo[iid]) consumo[iid] = { cantidad: 0, costo: 0 };
      const qty = Number(r.cantidad) * item.cantidad;
      const costoU = Number((r as any).insumos?.costo_por_unidad || 0);
      consumo[iid].cantidad += qty;
      consumo[iid].costo += qty * costoU;
    }
  }

  const sorted = Object.entries(consumo)
    .map(([iid, data]) => ({
      id: iid,
      nombre: insumos[iid]?.nombre || 'Desconocido',
      unidad: insumos[iid]?.unidad_medida || 'unidad',
      ...data,
    }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">📦 Insumos más utilizados</CardTitle></CardHeader>
      <CardContent>
        {!sorted.length ? (
          <p className="text-muted-foreground text-sm">Sin datos en este periodo</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Consumido</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((ins, i) => (
                <TableRow key={ins.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-6 justify-center">{i + 1}</Badge>
                      {ins.nombre}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatQty(ins.cantidad, ins.unidad)}</TableCell>
                  <TableCell className="text-right font-medium">S/ {ins.costo.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
