import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banknote, Smartphone, CreditCard } from 'lucide-react';

interface Props {
  ordenes: any[];
}

export default function DesglosePagos({ ordenes }: Props) {
  const porMetodo: Record<string, { count: number; total: number }> = {};
  for (const o of ordenes) {
    const m = o.metodo_pago || 'sin_definir';
    if (!porMetodo[m]) porMetodo[m] = { count: 0, total: 0 };
    porMetodo[m].count++;
    porMetodo[m].total += Number(o.total);
  }

  const totalGeneral = ordenes.reduce((a, o) => a + Number(o.total), 0);

  const metodoLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    efectivo: { label: 'Efectivo', icon: <Banknote className="h-4 w-4" /> },
    yape_plin: { label: 'Yape / Plin', icon: <Smartphone className="h-4 w-4" /> },
    tarjeta: { label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> },
    sin_definir: { label: 'Sin definir', icon: null },
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Desglose por método de pago</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Órdenes</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(porMetodo).sort((a, b) => b[1].total - a[1].total).map(([metodo, data]) => {
              const info = metodoLabels[metodo] || { label: metodo, icon: null };
              return (
                <TableRow key={metodo}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">{info.icon}{info.label}</div>
                  </TableCell>
                  <TableCell className="text-right">{data.count}</TableCell>
                  <TableCell className="text-right font-semibold">S/ {data.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{totalGeneral > 0 ? ((data.total / totalGeneral) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
