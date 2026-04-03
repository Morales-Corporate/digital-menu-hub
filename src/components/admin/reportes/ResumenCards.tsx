import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Receipt, Building2, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  totalVentas: number;
  totalOrdenes: number;
  costoInsumos: number;
  costoOperativo: number;
  utilidadBruta: number;
  utilidadNeta: number;
  margenBruto: number;
  margenNeto: number;
}

export default function ResumenCards({ totalVentas, totalOrdenes, costoInsumos, costoOperativo, utilidadBruta, utilidadNeta, margenBruto, margenNeto }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Ingresos</span>
          </div>
          <p className="text-xl font-bold">S/ {totalVentas.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{totalOrdenes} órdenes</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Receipt className="h-4 w-4" />
            <span className="text-xs">Costo insumos</span>
          </div>
          <p className="text-xl font-bold text-orange-500">S/ {costoInsumos.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Basado en recetas</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs">Gastos operativos</span>
          </div>
          <p className="text-xl font-bold text-orange-500">S/ {costoOperativo.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Utilidad bruta</span>
          </div>
          <p className={`text-xl font-bold ${utilidadBruta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            S/ {utilidadBruta.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">Margen: {margenBruto.toFixed(1)}%</p>
        </CardContent>
      </Card>
      <Card className={utilidadNeta >= 0 ? 'border-green-500/50' : 'border-destructive/50'}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            {utilidadNeta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="text-xs font-semibold">Utilidad neta</span>
          </div>
          <p className={`text-xl font-bold ${utilidadNeta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            S/ {utilidadNeta.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">Margen: {margenNeto.toFixed(1)}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Ticket promedio</span>
          </div>
          <p className="text-xl font-bold">S/ {totalOrdenes > 0 ? (totalVentas / totalOrdenes).toFixed(2) : '0.00'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
