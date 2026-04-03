import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  totalVentas: number;
  costoInsumos: number;
  utilidadBruta: number;
  margenBruto: number;
  costosOperativos: any[];
  costoOpTotal: number;
  utilidadNeta: number;
  margenNeto: number;
  dias: number;
}

export default function DesgloseUtilidad({ totalVentas, costoInsumos, utilidadBruta, margenBruto, costosOperativos, costoOpTotal, utilidadNeta, margenNeto, dias }: Props) {
  const pct = (val: number) => totalVentas > 0 ? ((val / totalVentas) * 100).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Desglose de utilidad</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">% ventas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Ventas totales</TableCell>
              <TableCell className="text-right font-semibold">S/ {totalVentas.toFixed(2)}</TableCell>
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-destructive">(-) Costo de insumos</TableCell>
              <TableCell className="text-right text-destructive">S/ {costoInsumos.toFixed(2)}</TableCell>
              <TableCell className="text-right text-destructive">{pct(costoInsumos)}%</TableCell>
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableCell className="font-semibold">= Utilidad bruta</TableCell>
              <TableCell className="text-right font-semibold">S/ {utilidadBruta.toFixed(2)}</TableCell>
              <TableCell className="text-right font-semibold">{margenBruto.toFixed(1)}%</TableCell>
            </TableRow>
            {costosOperativos?.map((c: any) => {
              const montoMensual = c.periodo === 'mensual' ? Number(c.monto) : c.periodo === 'quincenal' ? Number(c.monto) * 2 : Number(c.monto) * 4;
              const montoPeriodo = (montoMensual / 30) * dias;
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground pl-8">(-) {c.nombre}</TableCell>
                  <TableCell className="text-right text-muted-foreground">S/ {montoPeriodo.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{pct(montoPeriodo)}%</TableCell>
                </TableRow>
              );
            })}
            <TableRow className={utilidadNeta >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}>
              <TableCell className="font-bold text-lg">= Utilidad neta</TableCell>
              <TableCell className={`text-right font-bold text-lg ${utilidadNeta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                S/ {utilidadNeta.toFixed(2)}
              </TableCell>
              <TableCell className={`text-right font-bold ${utilidadNeta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {margenNeto.toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
