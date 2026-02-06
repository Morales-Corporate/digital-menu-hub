import { forwardRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrdenItem {
  producto_id: string | null;
  cantidad: number;
  precio_unitario: number;
  productos?: {
    nombre: string;
  } | null;
}

interface ComprobanteData {
  tipo: 'boleta' | 'factura';
  serie: string;
  numero: number;
  fecha: Date;
  // Empresa
  empresa: {
    nombre_comercial: string;
    razon_social?: string | null;
    ruc?: string | null;
    direccion?: string | null;
    telefono?: string | null;
    mensaje_pie?: string | null;
    logo_url?: string | null;
  };
  // Cliente
  cliente: {
    nombre?: string;
    documento?: string; // DNI for boleta
    ruc?: string; // RUC for factura
    razon_social?: string; // For factura
    direccion?: string;
  };
  // Order details
  items: OrdenItem[];
  subtotal: number;
  igv: number;
  total: number;
  mesa?: number;
  metodo_pago?: string;
}

interface TicketComprobanteProps {
  data: ComprobanteData;
  formato: 'ticket' | 'a5';
}

const TicketComprobante = forwardRef<HTMLDivElement, TicketComprobanteProps>(
  ({ data, formato }, ref) => {
    const { tipo, serie, numero, fecha, empresa, cliente, items, subtotal, igv, total, mesa, metodo_pago } = data;
    
    const numeroFormateado = `${serie}-${String(numero).padStart(8, '0')}`;
    const tipoLabel = tipo === 'boleta' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'FACTURA ELECTRÓNICA';

    const metodoPagoLabel = {
      efectivo: 'Efectivo',
      yape_plin: 'Yape/Plin',
      tarjeta: 'Tarjeta',
      pago_pendiente: 'Pendiente'
    }[metodo_pago || 'efectivo'] || metodo_pago;

    if (formato === 'ticket') {
      // Thermal ticket format (80mm width)
      return (
        <div 
          ref={ref} 
          className="bg-white text-black p-4 font-mono text-xs"
          style={{ width: '80mm', minHeight: '100mm' }}
        >
          {/* Header */}
          <div className="text-center mb-4">
            {empresa.logo_url && (
              <img src={empresa.logo_url} alt="Logo" className="h-12 mx-auto mb-2" />
            )}
            <div className="font-bold text-sm">{empresa.nombre_comercial}</div>
            {empresa.razon_social && <div>{empresa.razon_social}</div>}
            {empresa.ruc && <div>RUC: {empresa.ruc}</div>}
            {empresa.direccion && <div>{empresa.direccion}</div>}
            {empresa.telefono && <div>Tel: {empresa.telefono}</div>}
          </div>

          <div className="border-t border-b border-dashed border-black py-2 my-2 text-center">
            <div className="font-bold">{tipoLabel}</div>
            <div className="font-bold text-sm">{numeroFormateado}</div>
          </div>

          {/* Date & Client */}
          <div className="mb-3">
            <div>Fecha: {format(fecha, 'dd/MM/yyyy HH:mm', { locale: es })}</div>
            {mesa && <div>Mesa: {mesa}</div>}
            {tipo === 'boleta' ? (
              <>
                {cliente.nombre && <div>Cliente: {cliente.nombre}</div>}
                {cliente.documento && <div>DNI: {cliente.documento}</div>}
              </>
            ) : (
              <>
                {cliente.razon_social && <div>Razón Social: {cliente.razon_social}</div>}
                {cliente.ruc && <div>RUC: {cliente.ruc}</div>}
                {cliente.direccion && <div>Dirección: {cliente.direccion}</div>}
              </>
            )}
          </div>

          {/* Items */}
          <div className="border-t border-dashed border-black pt-2">
            <div className="flex justify-between font-bold mb-1">
              <span>DESCRIPCIÓN</span>
              <span>TOTAL</span>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-1">
                <div className="flex-1">
                  <div>{item.productos?.nombre || 'Producto'}</div>
                  <div className="text-[10px]">
                    {item.cantidad} x S/ {item.precio_unitario.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  S/ {(item.cantidad * item.precio_unitario).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-black pt-2 mt-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IGV (18%):</span>
              <span>S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
              <span>TOTAL:</span>
              <span>S/ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="mt-2 text-center">
            <div>Método de pago: {metodoPagoLabel}</div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4 pt-2 border-t border-dashed border-black">
            <div>{empresa.mensaje_pie || 'Gracias por su preferencia'}</div>
            <div className="mt-2 text-[10px]">
              Representación impresa del comprobante electrónico
            </div>
          </div>
        </div>
      );
    }

    // A5 format (more traditional)
    return (
      <div 
        ref={ref} 
        className="bg-white text-black p-8 font-sans text-sm"
        style={{ width: '148mm', minHeight: '210mm' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            {empresa.logo_url && (
              <img src={empresa.logo_url} alt="Logo" className="h-16 mb-2" />
            )}
            <div className="font-bold text-lg">{empresa.nombre_comercial}</div>
            {empresa.razon_social && <div>{empresa.razon_social}</div>}
            {empresa.direccion && <div className="text-xs">{empresa.direccion}</div>}
            {empresa.telefono && <div className="text-xs">Tel: {empresa.telefono}</div>}
          </div>
          <div className="border-2 border-black p-4 text-center">
            <div className="font-bold text-xs mb-1">RUC: {empresa.ruc || '---'}</div>
            <div className="font-bold">{tipoLabel}</div>
            <div className="font-bold text-lg">{numeroFormateado}</div>
          </div>
        </div>

        {/* Client info */}
        <div className="border border-black p-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-bold">Fecha: </span>
              {format(fecha, "dd 'de' MMMM 'del' yyyy", { locale: es })}
            </div>
            {mesa && (
              <div>
                <span className="font-bold">Mesa: </span>{mesa}
              </div>
            )}
          </div>
          {tipo === 'boleta' ? (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <span className="font-bold">Cliente: </span>
                {cliente.nombre || 'Consumidor Final'}
              </div>
              <div>
                <span className="font-bold">DNI: </span>
                {cliente.documento || '---'}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-2">
                <span className="font-bold">Razón Social: </span>
                {cliente.razon_social || '---'}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="font-bold">RUC: </span>
                  {cliente.ruc || '---'}
                </div>
                <div>
                  <span className="font-bold">Dirección: </span>
                  {cliente.direccion || '---'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Items table */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border border-black bg-gray-100">
              <th className="border border-black p-2 text-left">Cant.</th>
              <th className="border border-black p-2 text-left">Descripción</th>
              <th className="border border-black p-2 text-right">P. Unit.</th>
              <th className="border border-black p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border border-black">
                <td className="border border-black p-2">{item.cantidad}</td>
                <td className="border border-black p-2">{item.productos?.nombre || 'Producto'}</td>
                <td className="border border-black p-2 text-right">S/ {item.precio_unitario.toFixed(2)}</td>
                <td className="border border-black p-2 text-right">S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-48">
            <div className="flex justify-between border-b py-1">
              <span>Subtotal:</span>
              <span>S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b py-1">
              <span>IGV (18%):</span>
              <span>S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>TOTAL:</span>
              <span>S/ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-4">
          <span className="font-bold">Método de pago: </span>{metodoPagoLabel}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 pt-4 border-t">
          <div className="text-sm">{empresa.mensaje_pie || 'Gracias por su preferencia'}</div>
          <div className="mt-2 text-xs text-gray-500">
            Representación impresa del comprobante electrónico
          </div>
        </div>
      </div>
    );
  }
);

TicketComprobante.displayName = 'TicketComprobante';

export default TicketComprobante;