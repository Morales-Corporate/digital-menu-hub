import { useState, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, QrCode } from 'lucide-react';

export default function Mesas() {
  const [cantidadMesas, setCantidadMesas] = useState(10);
  const [dominio, setDominio] = useState(window.location.origin);
  const printRef = useRef<HTMLDivElement>(null);

  const mesas = Array.from({ length: cantidadMesas }, (_, i) => i + 1);

  const getQRUrl = (numeroMesa: number) => {
    return `${dominio}/mesa/${numeroMesa}`;
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCodes = mesas.map(mesa => {
      const url = getQRUrl(mesa);
      return `
        <div style="page-break-inside: avoid; text-align: center; padding: 20px; border: 1px dashed #ccc; margin: 10px;">
          <h2 style="font-size: 24px; margin-bottom: 10px;">Mesa ${mesa}</h2>
          <div id="qr-${mesa}"></div>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">${url}</p>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Códigos QR - Mesas</title>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; padding: 20px; }
            @media print { 
              .grid { grid-template-columns: repeat(2, 1fr); }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="padding: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
              Imprimir Códigos QR
            </button>
          </div>
          <div class="grid">${qrCodes}</div>
          <script>
            ${mesas.map(mesa => `
              QRCode.toCanvas(document.createElement('canvas'), '${getQRUrl(mesa)}', { width: 150 }, function(error, canvas) {
                if (!error) document.getElementById('qr-${mesa}').appendChild(canvas);
              });
            `).join('')}
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSingle = (mesa: number) => {
    const svg = document.getElementById(`qr-svg-${mesa}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      link.download = `mesa-${mesa}-qr.png`;
      link.href = pngUrl;
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Mesas y Códigos QR</h1>
            <p className="text-muted-foreground mt-1">Genera códigos QR para que los clientes puedan ordenar desde sus mesas</p>
          </div>
          <Button onClick={handlePrintAll} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Todos
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad de Mesas</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min={1}
                  max={100}
                  value={cantidadMesas}
                  onChange={(e) => setCantidadMesas(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dominio">Dominio del sitio</Label>
                <Input
                  id="dominio"
                  type="text"
                  value={dominio}
                  onChange={(e) => setDominio(e.target.value)}
                  placeholder="https://tudominio.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" ref={printRef}>
          {mesas.map((mesa) => (
            <Card key={mesa} className="text-center">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <QrCode className="h-5 w-5 text-primary" />
                  Mesa {mesa}
                </div>
                <div className="flex justify-center bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    id={`qr-svg-${mesa}`}
                    value={getQRUrl(mesa)}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {getQRUrl(mesa)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleDownloadSingle(mesa)}
                >
                  <Download className="h-4 w-4" />
                  Descargar PNG
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
