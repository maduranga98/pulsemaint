import { jsPDF } from 'jspdf';
// @ts-expect-error -- no type declarations for qrcode
import QRCode from 'qrcode';
import { resolveAppBaseUrl } from '@/lib/machineQr';
import { fetchImageAsDataUrl, imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';
import {
  SAFETY_CARD_HEIGHT_IN,
  SAFETY_CARD_WIDTH_IN,
  buildSafetyCardUrl,
  type ContractorSafetyCard,
} from '@/lib/safety/contractorSafety';

// Contractor Safety Card — a 3.5 × 2 inch PDF to print and laminate.
// Page 1 (front): who the holder is and that they are cleared to work on site.
// Page 2 (back): the QR code a safety officer scans to report a safety case
// against the holder, plus the contractor's contact person and validity.

const W = SAFETY_CARD_WIDTH_IN;
const H = SAFETY_CARD_HEIGHT_IN;
const MARGIN = 0.12;

const NAVY = '#0B2545';
const AMBER = '#F59E0B';
const GREEN = '#15803D';
const INK = '#1B2433';
const MUTED = '#64748B';
const LINE = '#CBD5E1';

// NotoSans (when it can be fetched) draws Latin/Greek/Cyrillic names the
// built-in Helvetica can't; the card still builds without it.
const FONT_FILES = {
  normal: '/fonts/NotoSans-Regular.ttf',
  bold: '/fonts/NotoSans-Bold.ttf',
} as const;
const fontCache = new Map<string, Promise<string | null>>();

function loadFont(url: string): Promise<string | null> {
  let p = fontCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(binary);
      } catch {
        return null;
      }
    })().then((data) => {
      if (!data) fontCache.delete(url);
      return data;
    });
    fontCache.set(url, p);
  }
  return p;
}

type Weight = 'normal' | 'bold';

async function registerFonts(doc: jsPDF): Promise<(w: Weight) => void> {
  const [regular, bold] = await Promise.all([loadFont(FONT_FILES.normal), loadFont(FONT_FILES.bold)]);
  let custom = false;
  try {
    if (regular && bold) {
      doc.addFileToVFS('NotoSans-Regular.ttf', regular);
      doc.addFont('NotoSans-Regular.ttf', 'CardSans', 'normal');
      doc.addFileToVFS('NotoSans-Bold.ttf', bold);
      doc.addFont('NotoSans-Bold.ttf', 'CardSans', 'bold');
      custom = true;
    }
  } catch {
    custom = false;
  }
  return (w) => doc.setFont(custom ? 'CardSans' : 'helvetica', w);
}

function fmtDate(ts: unknown): string {
  const t = ts as { toDate?: () => Date; toMillis?: () => number; seconds?: number } | null | undefined;
  const d = t?.toDate ? t.toDate() : t?.seconds ? new Date(t.seconds * 1000) : null;
  return (d ?? new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Single line, shrunk from `maxSize` towards `minSize`, then truncated with an ellipsis. */
function fitLine(doc: jsPDF, text: string, maxWidth: number, maxSize: number, minSize: number): { text: string; size: number } {
  let size = maxSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.25;
    doc.setFontSize(size);
  }
  if (doc.getTextWidth(text) <= maxWidth) return { text, size };
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidth) out = out.slice(0, -1);
  return { text: `${out.trimEnd()}…`, size };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function header(doc: jsPDF, setFont: (w: Weight) => void, height: number) {
  doc.setFillColor(NAVY);
  doc.rect(0, 0, W, height, 'F');
  doc.setFillColor(AMBER);
  doc.rect(0, height, W, 0.025, 'F');
  setFont('bold');
}

function field(
  doc: jsPDF,
  setFont: (w: Weight) => void,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  setFont('bold');
  doc.setFontSize(4.6);
  doc.setTextColor(MUTED);
  doc.text(label.toUpperCase(), x, y);
  setFont('normal');
  doc.setTextColor(INK);
  const fit = fitLine(doc, value || '—', width, 6.8, 5);
  doc.setFontSize(fit.size);
  doc.text(fit.text, x, y + 0.1);
}

export interface SafetyCardPdfOptions {
  /** What the QR code encodes. Defaults to the card's report link on the running app. */
  qrUrl?: string;
  /** Holder photo as a data URL; initials are drawn when absent. */
  photoDataUrl?: string | null;
}

export async function buildSafetyCardPdf(card: ContractorSafetyCard, opts: SafetyCardPdfOptions = {}): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [W, H], compress: true });
  const setFont = await registerFonts(doc);
  const qrUrl = opts.qrUrl ?? buildSafetyCardUrl(resolveAppBaseUrl(), card.id);
  const site = card.plantName || card.companyName;

  // ── Front ────────────────────────────────────────────────────────────────
  header(doc, setFont, 0.4);
  doc.setTextColor('#FFFFFF');
  const brand = fitLine(doc, card.companyName || 'FirmiCore', 1.95, 8, 5.5);
  doc.setFontSize(brand.size);
  doc.text(brand.text, MARGIN, 0.19);
  if (card.plantName && card.plantName !== card.companyName) {
    setFont('normal');
    const plant = fitLine(doc, card.plantName, 1.95, 5.2, 4.2);
    doc.setFontSize(plant.size);
    doc.setTextColor('#CBD5E1');
    doc.text(plant.text, MARGIN, 0.31);
  }
  setFont('bold');
  doc.setFontSize(6.4);
  doc.setTextColor(AMBER);
  doc.text('CONTRACTOR', W - MARGIN, 0.17, { align: 'right' });
  doc.setTextColor('#FFFFFF');
  doc.text('SAFETY CARD', W - MARGIN, 0.29, { align: 'right' });

  // Photo
  const px = MARGIN;
  const py = 0.54;
  const pw = 0.82;
  const ph = 1.02;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.01);
  if (opts.photoDataUrl) {
    try {
      doc.addImage(opts.photoDataUrl, imageFormatFromDataUrl(opts.photoDataUrl), px, py, pw, ph, undefined, 'FAST');
    } catch {
      drawInitials();
    }
  } else {
    drawInitials();
  }
  doc.rect(px, py, pw, ph, 'S');

  function drawInitials() {
    doc.setFillColor('#E2E8F0');
    doc.rect(px, py, pw, ph, 'F');
    setFont('bold');
    doc.setFontSize(20);
    doc.setTextColor('#94A3B8');
    doc.text(initials(card.holderName) || '?', px + pw / 2, py + ph / 2 + 0.07, { align: 'center' });
  }

  // Details
  const dx = px + pw + 0.14;
  const dw = W - dx - MARGIN;
  setFont('bold');
  doc.setTextColor(NAVY);
  let name = fitLine(doc, card.holderName, dw, 10, 7.5);
  let nameLines = [name.text];
  if (doc.getTextWidth(card.holderName) > dw && name.size <= 7.5) {
    doc.setFontSize(7.5);
    nameLines = (doc.splitTextToSize(card.holderName, dw) as string[]).slice(0, 2);
    name = { text: nameLines[0], size: 7.5 };
  }
  doc.setFontSize(name.size);
  nameLines.forEach((line, i) => doc.text(line, dx, 0.68 + i * 0.12));
  const top = 0.68 + (nameLines.length - 1) * 0.12 + 0.17;
  // Last label sits at 1.60 so its value (+0.1) clears the footer strip at 1.76.
  const step = (1.6 - top) / 3;
  field(doc, setFont, dx, top, dw, 'National ID / Passport', card.holderNic);
  field(doc, setFont, dx, top + step, dw, 'Position', card.holderPosition);
  field(doc, setFont, dx, top + step * 2, dw, 'Field', card.holderField);
  field(doc, setFont, dx, top + step * 3, dw, 'Contractor', card.contractorName);

  // Footer strip
  doc.setFillColor(GREEN);
  doc.rect(0, 1.76, W, H - 1.76, 'F');
  setFont('bold');
  doc.setTextColor('#FFFFFF');
  const auth = fitLine(doc, `SAFETY CLEARED · AUTHORISED TO WORK AT ${site}`.toUpperCase(), W - 2 * MARGIN, 5.6, 4);
  doc.setFontSize(auth.size);
  doc.text(auth.text, W / 2, 1.9, { align: 'center' });

  // ── Back ─────────────────────────────────────────────────────────────────
  doc.addPage([W, H], 'landscape');
  header(doc, setFont, 0.3);
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(7);
  doc.text('SCAN TO REPORT A SAFETY CASE', W / 2, 0.2, { align: 'center' });

  const qrSize = 1.1;
  const qr = await QRCode.toDataURL(qrUrl, { margin: 0, width: 480, errorCorrectionLevel: 'M' });
  doc.setDrawColor(LINE);
  doc.rect(MARGIN, 0.44, qrSize + 0.12, qrSize + 0.12, 'S');
  doc.addImage(qr, 'PNG', MARGIN + 0.06, 0.5, qrSize, qrSize);
  setFont('bold');
  doc.setFontSize(5.6);
  doc.setTextColor(INK);
  doc.text(card.cardNumber, MARGIN + (qrSize + 0.12) / 2, 1.82, { align: 'center' });

  const bx = MARGIN + qrSize + 0.12 + 0.16;
  const bw = W - bx - MARGIN;
  setFont('bold');
  doc.setFontSize(4.6);
  doc.setTextColor(MUTED);
  doc.text('CONTRACTOR CONTACT PERSON', bx, 0.52);
  setFont('bold');
  doc.setTextColor(NAVY);
  const cn = fitLine(doc, card.contactPersonName || '—', bw, 7.6, 5.5);
  doc.setFontSize(cn.size);
  doc.text(cn.text, bx, 0.64);
  setFont('normal');
  doc.setTextColor(INK);
  const cp = fitLine(doc, card.contactPersonDesignation || '—', bw, 6.2, 4.8);
  doc.setFontSize(cp.size);
  doc.text(cp.text, bx, 0.75);
  setFont('bold');
  const ph2 = fitLine(doc, card.contactPersonPhone || '—', bw, 7, 5);
  doc.setFontSize(ph2.size);
  doc.text(ph2.text, bx, 0.87);

  doc.setDrawColor(LINE);
  doc.line(bx, 0.96, W - MARGIN, 0.96);
  field(doc, setFont, bx, 1.08, bw, 'Contractor', card.contractorName);
  const half = (bw - 0.08) / 2;
  field(doc, setFont, bx, 1.32, half, 'Issued', fmtDate(card.issuedAt));
  field(doc, setFont, bx + half + 0.08, 1.32, half, 'Valid until', fmtDate(card.validUntil));

  setFont('normal');
  doc.setFontSize(4.6);
  doc.setTextColor(MUTED);
  const note = doc.splitTextToSize(`Safety training: ${card.moduleTitle}. Valid while this card is active.`, bw) as string[];
  doc.text(note.slice(0, 2), bx, 1.62);

  return doc;
}

export function safetyCardFileName(card: Pick<ContractorSafetyCard, 'holderName' | 'cardNumber'>): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
  return `safety-card_${clean(card.holderName) || 'holder'}_${clean(card.cardNumber) || 'card'}.pdf`;
}

/** Builds the card PDF (fetching the holder photo when there is one) and downloads it. */
export async function downloadSafetyCardPdf(card: ContractorSafetyCard): Promise<void> {
  const photoDataUrl = card.holderPhotoUrl ? await fetchImageAsDataUrl(card.holderPhotoUrl) : null;
  const doc = await buildSafetyCardPdf(card, { photoDataUrl });
  doc.save(safetyCardFileName(card));
}
