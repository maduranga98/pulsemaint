/**
 * Machine QR code generation utilities.
 *
 * QR codes encode machine profile URLs for scanning at physical machines.
 * URL format: https://app.pulsemaint.com/scan?machineId={id}&siteId={siteId}
 */

export interface QRCodeData {
  machineId: string;
  siteId: string;
  machineName: string;
  department: string;
  bay?: string;
  station?: string;
}

export function generateMachineQrUrl(machineId: string, siteId: string): string {
  const baseUrl = import.meta.env.VITE_APP_URL || 'https://app.pulsemaint.com';
  const params = new URLSearchParams({
    machineId,
    siteId,
  });
  return `${baseUrl}/scan?${params.toString()}`;
}

export function generateMachineQrData(data: QRCodeData): string {
  return generateMachineQrUrl(data.machineId, data.siteId);
}

export interface QRSticker {
  layout: '1' | '4' | '9'; // 1, 4, or 9 stickers per page
  pageSize: 'A4' | 'Letter';
  filename: string;
}

export function getQRStickerLayout(layout: '1' | '4' | '9'): {
  cols: number;
  rows: number;
  marginMm: number;
  gapMm: number;
} {
  const layouts = {
    '1': { cols: 1, rows: 1, marginMm: 20, gapMm: 10 },
    '4': { cols: 2, rows: 2, marginMm: 15, gapMm: 10 },
    '9': { cols: 3, rows: 3, marginMm: 10, gapMm: 8 },
  };
  return layouts[layout];
}

export function calculateQRStickerSize(layout: '1' | '4' | '9'): {
  widthMm: number;
  heightMm: number;
} {
  // A4 dimensions: 210mm x 297mm
  const layouts = {
    '1': { widthMm: 120, heightMm: 120 },
    '4': { widthMm: 85, heightMm: 100 },
    '9': { widthMm: 65, heightMm: 85 },
  };
  return layouts[layout];
}

export function generateQRFilename(machineId: string, layout: '1' | '4' | '9'): string {
  const date = new Date().toISOString().split('T')[0];
  return `qr_${machineId}_${layout}_stickers_${date}.pdf`;
}

/**
 * Download QR code as PNG image (client-side).
 * Uses canvas for export.
 */
export async function downloadQRCodeAsImage(
  qrCanvas: HTMLCanvasElement,
  machineId: string
): Promise<void> {
  const url = qrCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `qr_${machineId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Trigger PDF download (from Firebase Storage or Cloud Function).
 */
export function downloadQRCodePdf(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Print QR code with browser print dialog.
 */
export function printQRCode(element: HTMLElement): void {
  const printWindow = window.open('', '', 'height=600,width=800');
  if (!printWindow) return;

  const printContent = element.innerHTML;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Machine QR Code</title>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          .qr-print-container { page-break-inside: avoid; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      </style>
    </head>
    <body>
      <div class="qr-print-container">
        ${printContent}
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
