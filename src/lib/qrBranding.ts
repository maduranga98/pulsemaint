import { resolveCompanyLogoDataUrl } from './pdf/logoUtils';

const FIRMICORE_WEBSITE = 'https://firmicore.com/';
const FIRMICORE_LOGO_SRC = '/logo.svg';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface QrBrandingInfo {
  companyName: string;
  companyLogoUrl?: string | null;
  companyLogoDataUrl?: string | null;
  title: string;
  subtitle?: string;
}

/**
 * Composes a single print/download-ready canvas: the issuing company's own
 * logo/name up top, the QR code itself, a title/subtitle, and a FirmiCore
 * footer (logo + name + website) — every machine/part QR that leaves the
 * app carries both identities, whether it's downloaded as a PNG or printed.
 */
export async function composeBrandedQrCanvas(
  qrCanvas: HTMLCanvasElement,
  info: QrBrandingInfo,
): Promise<HTMLCanvasElement> {
  const width = 480;
  const qrSize = 300;
  const padding = 24;
  const headerH = 70;
  const footerH = 60;
  const titleBlockH = info.subtitle ? 56 : 36;
  const height = headerH + padding + qrSize + titleBlockH + footerH + padding;

  const companyLogoDataUrl =
    info.companyLogoDataUrl ?? (await resolveCompanyLogoDataUrl({ logoUrl: info.companyLogoUrl }));
  const [companyLogoImg, firmicoreLogoImg] = await Promise.all([
    companyLogoDataUrl ? loadImage(companyLogoDataUrl) : Promise.resolve(null),
    loadImage(FIRMICORE_LOGO_SRC),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrCanvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header: company logo + name
  const logoSize = 40;
  let x = padding;
  if (companyLogoImg) {
    ctx.drawImage(companyLogoImg, x, 16, logoSize, logoSize);
    x += logoSize + 10;
  }
  ctx.fillStyle = '#0A1628';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(info.companyName || 'Company', x, 16 + logoSize / 2);

  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(padding, headerH);
  ctx.lineTo(width - padding, headerH);
  ctx.stroke();

  // QR code
  const qrY = headerH + padding;
  const qrX = (width - qrSize) / 2;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // Title / subtitle
  let textY = qrY + qrSize + 24;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(info.title, width / 2, textY);
  if (info.subtitle) {
    textY += 22;
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#6B7280';
    ctx.fillText(info.subtitle, width / 2, textY);
  }

  // Footer: FirmiCore branding
  const footerY = height - footerH;
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(padding, footerY);
  ctx.lineTo(width - padding, footerY);
  ctx.stroke();

  const fLogoSize = 24;
  const footerCenterY = footerY + footerH / 2;
  // Measure the text block width first so the logo+text group can be centered.
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const nameWidth = ctx.measureText('FirmiCore').width;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const urlWidth = ctx.measureText(FIRMICORE_WEBSITE).width;
  const textWidth = Math.max(nameWidth, urlWidth);
  const groupWidth = (firmicoreLogoImg ? fLogoSize + 8 : 0) + textWidth;
  let fx = (width - groupWidth) / 2;

  if (firmicoreLogoImg) {
    ctx.drawImage(firmicoreLogoImg, fx, footerCenterY - fLogoSize / 2, fLogoSize, fLogoSize);
    fx += fLogoSize + 8;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0A1628';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('FirmiCore', fx, footerCenterY - 8);
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText(FIRMICORE_WEBSITE, fx, footerCenterY + 8);

  return canvas;
}

export function downloadCanvasAsImage(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printCanvas(canvas: HTMLCanvasElement, docTitle: string): void {
  const printWindow = window.open('', '', 'height=760,width=560');
  if (!printWindow) return;
  const dataUrl = canvas.toDataURL('image/png');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle}</title>
      <style>
        @media print { body { margin: 0; padding: 0; } }
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        img { max-width: 100%; }
      </style>
    </head>
    <body><img src="${dataUrl}" width="${canvas.width}" height="${canvas.height}" /></body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  // Give the print window a beat to decode the embedded image before printing.
  setTimeout(() => printWindow.print(), 300);
}
