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

const PRODUCTION_APP_URL = 'https://pulsemaint.web.app';

/**
 * Resolve the base URL to encode in QR codes.
 *
 * QR codes are scanned on physical machines, so they must NEVER point at
 * localhost. We resolve at runtime (not build time) so the value is always
 * correct wherever the app is served:
 *   1. The actual origin the app is running on, when it is not localhost
 *      (this makes deployed builds self-correcting — e.g. pulsemaint.web.app).
 *   2. VITE_APP_URL, when it is configured and not a localhost URL.
 *   3. The hardcoded production URL as a final fallback.
 */
function resolveAppBaseUrl(): string {
  const isLocalhost = (url: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(url);

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && !isLocalhost(origin)) return origin;
  }

  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl && !isLocalhost(envUrl)) return envUrl;

  return PRODUCTION_APP_URL;
}

export function generateMachineQrUrl(machineId: string, siteId: string): string {
  const baseUrl = resolveAppBaseUrl();
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
