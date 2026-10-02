import { jsPDF } from 'jspdf';
// @ts-expect-error -- no type declarations for qrcode
import QRCode from 'qrcode';
import { resolveAppBaseUrl } from '@/lib/machineQr';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';
import {
  SAFETY_CARD_HEIGHT_IN,
  SAFETY_CARD_WIDTH_IN,
  buildSafetyCardUrl,
  type ContractorSafetyCard,
} from '@/lib/safety/contractorSafety';

// Contractor Safety Card — a 3.5 × 2 inch, two-page PDF to print and laminate.
//
//   Front  who the holder is, who they work for, what they are qualified in,
//          and that they are cleared for site access (with the expiry).
//   Back   the QR code a safety officer scans to report a safety case against
//          the holder, the contractor's contact person, and who authorised it.
//
// Design: a white card, one restrained accent colour, hairline rules, three
// weights of one typeface (Montserrat, same as the training certificates) and a
// strict hierarchy — name, then labelled facts. The card carries the issuing
// company's own name and logo, never the platform's. Every fact appears exactly
// once: company and site in the header only, contractor on the front only,
// contact person on the back only, validity on the front only, card number and
// issue date on the back only.

const W = SAFETY_CARD_WIDTH_IN;
const H = SAFETY_CARD_HEIGHT_IN;
const M = 0.15; // outer margin

// Palette — slate neutrals plus a single deep-teal accent.
const INK = '#0F172A';
const BODY = '#334155';
const MUTED = '#64748B';
const HAIR = '#E2E8F0';
const TINT = '#F8FAFC';
const ACCENT = '#0F766E';

// ── Fonts ───────────────────────────────────────────────────────────────────
// Montserrat is a small Latin subset. Text it can't draw but Noto Sans can
// (Cyrillic, Greek, Latin Extended) uses Noto Sans, downloaded only when such
// text is present. Scripts that need OpenType shaping (Sinhala, Tamil, Arabic,
// Thai, CJK …) can't be drawn by jsPDF at all, so — as on the training
// certificates — they are drawn with the browser's own text engine onto a
// canvas and embedded as an image. If a font file can't be fetched the card
// still builds in the built-in Helvetica.

type Face = 'medium' | 'semibold' | 'bold';
type Script = 'montserrat' | 'noto' | 'raster';

const FONT_FILES = {
  medium: '/fonts/certificate/Montserrat-Medium.ttf',
  semibold: '/fonts/certificate/Montserrat-SemiBold.ttf',
  bold: '/fonts/certificate/Montserrat-Bold.ttf',
  notoRegular: '/fonts/NotoSans-Regular.ttf',
  notoBold: '/fonts/NotoSans-Bold.ttf',
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
      if (!data) fontCache.delete(url); // don't cache a failure
      return data;
    });
    fontCache.set(url, p);
  }
  return p;
}

const canvasAvailable = () => typeof document !== 'undefined';

function scriptOf(text: string): Script {
  let script: Script = 'montserrat';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // Same boundary as the certificates: everything from U+0530 up is raster,
    // except Latin Extended Additional / Greek Extended / punctuation and currency.
    if (code >= 0x0530 && !(code >= 0x1e00 && code <= 0x206f) && !(code >= 0x20a0 && code <= 0x20cf)) {
      return canvasAvailable() ? 'raster' : 'noto';
    }
    // Montserrat covers Basic Latin, Latin-1 and the general punctuation we use (– — • … ’).
    if (code > 0xff && !(code >= 0x2010 && code <= 0x2044)) script = 'noto';
  }
  return script;
}

const RASTER_SCALE = 8; // canvas pixels per point — ~580 dpi on a card, crisp when printed
const CANVAS_WEIGHT: Record<Face, number> = { medium: 500, semibold: 600, bold: 700 };
const CANVAS_FONT = `"Noto Sans Sinhala", "Noto Sans", "Segoe UI", "Nirmala UI", sans-serif`;

let measureCtx: CanvasRenderingContext2D | null | undefined;
function rasterCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      measureCtx = null;
    }
  }
  return measureCtx;
}

function rasterFont(size: number, face: Face): string {
  return `${CANVAS_WEIGHT[face]} ${size * RASTER_SCALE}px ${CANVAS_FONT}`;
}

/** Everything that draws or measures text on the card. */
export interface Painter {
  width: (text: string, size: number, face: Face, track?: number) => number;
  /** Draws one line with its baseline at y. Returns the width drawn. */
  draw: (
    text: string,
    x: number,
    y: number,
    o: { size: number; face: Face; color: string; align?: 'left' | 'right' | 'center'; track?: number },
  ) => number;
}

async function createPainter(doc: jsPDF, texts: string[]): Promise<Painter> {
  const needsNoto = texts.some((t) => scriptOf(t) === 'noto');
  const [medium, semibold, bold, notoRegular, notoBold] = await Promise.all([
    loadFont(FONT_FILES.medium),
    loadFont(FONT_FILES.semibold),
    loadFont(FONT_FILES.bold),
    needsNoto ? loadFont(FONT_FILES.notoRegular) : Promise.resolve(null),
    needsNoto ? loadFont(FONT_FILES.notoBold) : Promise.resolve(null),
  ]);

  const have = new Set<string>();
  const add = (data: string | null, file: string, family: string, style: string, key: string) => {
    if (!data) return;
    try {
      doc.addFileToVFS(file, data);
      doc.addFont(file, family, style);
      have.add(key);
    } catch {
      // unusable font file — Helvetica covers it
    }
  };
  add(medium, 'Montserrat-Medium.ttf', 'CardMont', 'normal', 'medium');
  add(bold, 'Montserrat-Bold.ttf', 'CardMont', 'bold', 'bold');
  add(semibold, 'Montserrat-SemiBold.ttf', 'CardMontSemi', 'normal', 'semibold');
  add(notoRegular, 'NotoSans-Regular.ttf', 'CardNoto', 'normal', 'notoRegular');
  add(notoBold, 'NotoSans-Bold.ttf', 'CardNoto', 'bold', 'notoBold');

  const useFont = (face: Face, script: Script) => {
    if (script !== 'montserrat' && have.has('notoRegular')) {
      doc.setFont('CardNoto', face === 'medium' || !have.has('notoBold') ? 'normal' : 'bold');
    } else if (face === 'bold' && have.has('bold')) doc.setFont('CardMont', 'bold');
    else if (face === 'semibold' && have.has('semibold')) doc.setFont('CardMontSemi', 'normal');
    else if (face === 'medium' && have.has('medium')) doc.setFont('CardMont', 'normal');
    else doc.setFont('helvetica', face === 'medium' ? 'normal' : 'bold');
  };

  const rasterWidth = (text: string, size: number, face: Face): number | null => {
    const ctx = rasterCtx();
    if (!ctx) return null;
    ctx.font = rasterFont(size, face);
    return ctx.measureText(text).width / (RASTER_SCALE * 72);
  };

  const width: Painter['width'] = (text, size, face, track = 0) => {
    const gaps = track * Math.max(0, [...text].length - 1);
    if (scriptOf(text) === 'raster') {
      const w = rasterWidth(text, size, face);
      if (w !== null) return w + gaps;
    }
    useFont(face, scriptOf(text));
    doc.setFontSize(size);
    return doc.getTextWidth(text) + gaps;
  };

  const draw: Painter['draw'] = (text, x, y, { size, face, color, align = 'left', track = 0 }) => {
    const w = width(text, size, face, track);
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    if (scriptOf(text) === 'raster' && rasterCtx()) {
      // Draw with the browser's text engine on a throw-away canvas, then embed it.
      const pad = 4;
      const wPx = Math.ceil(w * RASTER_SCALE * 72) + pad * 2;
      const hPx = Math.ceil(size * RASTER_SCALE * 1.7);
      const canvas = document.createElement('canvas');
      canvas.width = wPx;
      canvas.height = hPx;
      const c2 = canvas.getContext('2d');
      if (c2) {
        const baselinePx = Math.round(size * RASTER_SCALE * 1.2);
        c2.font = rasterFont(size, face);
        c2.fillStyle = color;
        c2.textBaseline = 'alphabetic';
        c2.fillText(text, pad, baselinePx);
        const inchPerPx = 1 / (RASTER_SCALE * 72);
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', left - pad * inchPerPx, y - baselinePx * inchPerPx, wPx * inchPerPx, hPx * inchPerPx);
        return w;
      }
    }
    useFont(face, scriptOf(text));
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(text, left, y, track ? { charSpace: track } : undefined);
    return w;
  };

  return { width, draw };
}

// ── Small helpers ───────────────────────────────────────────────────────────

function fmtDate(ts: unknown, upper = false): string {
  const t = ts as { toDate?: () => Date; seconds?: number } | null | undefined;
  const d = t?.toDate ? t.toDate() : t?.seconds ? new Date(t.seconds * 1000) : new Date();
  const out = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return upper ? out.toUpperCase() : out;
}

function truncate(text: string, maxWidth: number, widthOf: (s: string) => number): string {
  if (widthOf(text) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1 && widthOf(`${chars.join('')}…`) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/** One line, shrunk from maxSize towards minSize, then truncated with an ellipsis. */
function fitLine(p: Painter, text: string, face: Face, maxWidth: number, maxSize: number, minSize: number): { text: string; size: number } {
  let size = maxSize;
  while (size > minSize && p.width(text, size, face) > maxWidth) size -= 0.25;
  return { text: truncate(text, maxWidth, (s) => p.width(s, size, face)), size };
}

/** Greedy word wrap; a word wider than the line (or unspaced scripts) is broken by character. */
function wrapLines(p: Painter, text: string, face: Face, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (p.width(candidate, size, face) <= maxWidth) {
      line = candidate;
      continue;
    }
    push();
    if (p.width(word, size, face) <= maxWidth) {
      line = word;
      continue;
    }
    for (const ch of word) {
      if (line && p.width(line + ch, size, face) > maxWidth) push();
      line += ch;
    }
  }
  push();
  return lines;
}

/**
 * Packs qualifications into at most maxLines lines without ever splitting one
 * across lines. What doesn't fit is counted ("+2 more") rather than dropped
 * silently — the full list is always on the officer's sign-off record.
 */
export function packQualifications(
  p: Painter,
  items: string[],
  maxWidth: number,
  maxLines: number,
  sizes: number[],
  more: (n: number) => string,
): { lines: string[]; size: number } {
  const sep = '   •   ';
  const pack = (size: number) => {
    const lines: string[] = [];
    let rest = [...items];
    while (rest.length && lines.length < maxLines) {
      let line = '';
      let used = 0;
      for (const item of rest) {
        const next = line ? `${line}${sep}${item}` : item;
        if (p.width(next, size, 'medium') > maxWidth && line) break;
        line = next;
        used += 1;
      }
      lines.push(line);
      rest = rest.slice(used);
    }
    return { lines, rest };
  };

  for (const size of sizes) {
    const { lines, rest } = pack(size);
    if (!rest.length) {
      return { lines: lines.map((l) => truncate(l, maxWidth, (s) => p.width(s, size, 'medium'))), size };
    }
  }
  const size = sizes[sizes.length - 1];
  const { lines, rest } = pack(size);
  let hidden = rest.length;
  let last = lines[lines.length - 1].split(sep);
  // Make room for the "+N more" tail by moving trailing items into the count.
  while (last.length > 1 && p.width(`${last.join(sep)}${sep}${more(hidden)}`, size, 'medium') > maxWidth) {
    last.pop();
    hidden += 1;
  }
  if (p.width(`${last.join(sep)}${sep}${more(hidden)}`, size, 'medium') > maxWidth) {
    last = [truncate(last[0], maxWidth - p.width(`${sep}${more(hidden)}`, size, 'medium'), (s) => p.width(s, size, 'medium'))];
  }
  lines[lines.length - 1] = `${last.join(sep)}${sep}${more(hidden)}`;
  return { lines, size };
}

function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => [...part][0]?.toUpperCase() ?? '')
    .join('');
}

/** Draws an image inside a box without distorting it. */
function imageContain(doc: jsPDF, dataUrl: string, x: number, y: number, w: number, h: number, align: 'left' | 'center' = 'center'): boolean {
  try {
    const props = doc.getImageProperties(dataUrl);
    const scale = Math.min(w / props.width, h / props.height);
    const dw = props.width * scale;
    const dh = props.height * scale;
    const dx = align === 'center' ? x + (w - dw) / 2 : x;
    doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), dx, y + (h - dh) / 2, dw, dh, undefined, 'FAST');
    return true;
  } catch {
    return false;
  }
}

export interface SafetyCardPdfOptions {
  /** What the QR code encodes. Defaults to the card's report link on the running app. */
  qrUrl?: string;
  /** Holder photo as a data URL, already cropped to the photo frame; an empty photo space is drawn when absent. */
  photoDataUrl?: string | null;
  /** The issuing company's logo as a data URL; a monogram is drawn when absent. */
  logoDataUrl?: string | null;
}

/** Passport photo proportion, 35 × 45 mm — width:height of the holder's photo frame. Crop to this before passing `photoDataUrl`. */
export const SAFETY_CARD_PHOTO_ASPECT = 35 / 45;

/**
 * Where an over-tall photo is trimmed when it is cropped to the frame: nearer
 * the top than the middle, so a head-and-shoulders picture keeps the face and
 * loses the lower body rather than the top of the head.
 */
export const SAFETY_CARD_PHOTO_FOCUS_Y = 0.3;

export async function buildSafetyCardPdf(card: ContractorSafetyCard, opts: SafetyCardPdfOptions = {}): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [W, H], compress: true });
  const qualifications = (card.qualifications ?? []).map((q) => q.trim()).filter(Boolean);
  const p = await createPainter(doc, [
    card.companyName,
    card.plantName,
    card.holderName,
    card.holderNic,
    card.holderPosition,
    card.holderField,
    card.contractorName,
    card.contactPersonName,
    card.contactPersonDesignation,
    card.contactPersonPhone,
    card.moduleTitle,
    card.signedOffByName ?? '',
    card.signedOffByTitle ?? '',
    card.issuedByName,
    ...qualifications,
  ]);
  const qrUrl = opts.qrUrl ?? buildSafetyCardUrl(resolveAppBaseUrl(), card.id);

  const label = (text: string, x: number, y: number) =>
    p.draw(text.toUpperCase(), x, y, { size: 4.3, face: 'semibold', color: MUTED, track: 0.012 });
  const hairline = (x1: number, x2: number, y: number) => {
    doc.setDrawColor(HAIR);
    doc.setLineWidth(0.008);
    doc.line(x1, y, x2, y);
  };
  const accentRule = () => {
    doc.setFillColor(ACCENT);
    doc.rect(0, 0, W, 0.05, 'F');
  };

  // ════════════════════════════════ FRONT ════════════════════════════════════
  accentRule();

  // Header: the issuing company's logo + legal name (and site), the card title on the right.
  const logoSize = 0.3;
  const logoX = M;
  const logoY = 0.14;
  const drewLogo = opts.logoDataUrl ? imageContain(doc, opts.logoDataUrl, logoX, logoY, logoSize, logoSize, 'left') : false;
  if (!drewLogo) {
    doc.setFillColor(INK);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 0.04, 0.04, 'F');
    p.draw(initials(card.companyName) || '•', logoX + logoSize / 2, logoY + logoSize / 2 + 0.028, {
      size: 7.5,
      face: 'bold',
      color: '#FFFFFF',
      align: 'center',
    });
  }

  const textX = logoX + logoSize + 0.1;
  const titleRight = W - M;
  const headerRoom = titleRight - 0.58 - 0.1 - textX;
  const showPlant = !!card.plantName && card.plantName.trim().toLowerCase() !== (card.companyName ?? '').trim().toLowerCase();
  const companyName = card.companyName || '—';
  const company = fitLine(p, companyName, 'bold', headerRoom, 7.6, 5.4);
  if (company.text === companyName) {
    p.draw(company.text, textX, showPlant ? 0.265 : 0.31, { size: company.size, face: 'bold', color: INK });
    if (showPlant) {
      const plant = fitLine(p, card.plantName, 'medium', headerRoom, 5, 4);
      p.draw(plant.text, textX, 0.37, { size: plant.size, face: 'medium', color: MUTED });
    }
  } else {
    // The legal name is too long for one line: wrap it onto two smaller lines rather than cut it off.
    let lines = wrapLines(p, companyName, 'bold', 5.6, headerRoom);
    if (lines.length > 2) lines = [lines[0], truncate(lines.slice(1).join(' '), headerRoom, (s) => p.width(s, 5.6, 'bold'))];
    const top = showPlant ? 0.215 : 0.255;
    lines.forEach((line, i) => p.draw(line, textX, top + i * 0.088, { size: 5.6, face: 'bold', color: INK }));
    if (showPlant) {
      const plant = fitLine(p, card.plantName, 'medium', headerRoom, 4.6, 4);
      p.draw(plant.text, textX, top + lines.length * 0.088 + 0.002, { size: plant.size, face: 'medium', color: MUTED });
    }
  }
  p.draw('CONTRACTOR', titleRight, 0.255, { size: 4.3, face: 'semibold', color: MUTED, track: 0.012, align: 'right' });
  p.draw('SAFETY CARD', titleRight, 0.325, { size: 4.3, face: 'semibold', color: MUTED, track: 0.012, align: 'right' });
  hairline(M, W - M, 0.52);

  // Photo: a passport-proportion (35:45) frame filled with the holder's photo, or — when none is
  // registered — an empty, labelled space to fit one. Never a logo.
  const px = M;
  const py = 0.6;
  const ph = 1.08;
  const pw = ph * SAFETY_CARD_PHOTO_ASPECT;
  doc.setFillColor(TINT);
  doc.rect(px, py, pw, ph, 'F');
  if (!(opts.photoDataUrl && imageContain(doc, opts.photoDataUrl, px, py, pw, ph))) {
    doc.setDrawColor('#94A3B8');
    doc.setLineWidth(0.008);
    doc.setLineDashPattern([0.03, 0.03], 0);
    doc.rect(px + 0.05, py + 0.05, pw - 0.1, ph - 0.1, 'S');
    doc.setLineDashPattern([], 0);
    p.draw('PHOTO', px + pw / 2, py + ph / 2 - 0.01, { size: 5.2, face: 'semibold', color: MUTED, track: 0.02, align: 'center' });
    p.draw('35 × 45 mm', px + pw / 2, py + ph / 2 + 0.1, { size: 4.3, face: 'medium', color: MUTED, align: 'center' });
  }
  doc.setDrawColor(HAIR);
  doc.setLineWidth(0.01);
  doc.rect(px, py, pw, ph, 'S');

  // Identity column.
  const dx = px + pw + 0.17;
  const dw = W - M - dx;
  const holder = card.holderName || '—';
  const oneLine = fitLine(p, holder, 'bold', dw, 10.5, 7.5);
  let nameSize = oneLine.size;
  let nameLines = [oneLine.text];
  if (p.width(holder, nameSize, 'bold') > dw) {
    nameSize = 7.5;
    nameLines = wrapLines(p, holder, 'bold', nameSize, dw);
    if (nameLines.length > 2) {
      nameLines = [nameLines[0], truncate(nameLines.slice(1).join(' '), dw, (s) => p.width(s, nameSize, 'bold'))];
    }
  }
  const namePitch = nameSize * 0.0155;
  const nameTop = 0.775;
  nameLines.forEach((line, i) => p.draw(line, dx, nameTop + i * namePitch, { size: nameSize, face: 'bold', color: INK }));
  const nameBottom = nameTop + (nameLines.length - 1) * namePitch;

  const position = fitLine(p, card.holderPosition || '—', 'semibold', dw, 6.4, 5);
  p.draw(position.text, dx, nameBottom + 0.125, { size: position.size, face: 'semibold', color: ACCENT });

  const FACT_MAX = 6;
  const FACT_MIN = 4.6;
  const rowA = nameBottom + 0.275;
  label('Contractor', dx, rowA);
  const contractor = fitLine(p, card.contractorName || '—', 'medium', dw, FACT_MAX, FACT_MIN);
  p.draw(contractor.text, dx, rowA + 0.093, { size: contractor.size, face: 'medium', color: BODY });

  // National ID and Field share a row and a type size, so the two values read as a pair.
  const rowB = rowA + 0.205;
  const idWidth = 0.92;
  const fieldX = dx + idWidth + 0.1;
  const fieldWidth = W - M - fieldX;
  const nicText = card.holderNic || '—';
  const fieldText = card.holderField || '—';
  const pairSize = Math.min(
    fitLine(p, nicText, 'medium', idWidth, FACT_MAX, FACT_MIN).size,
    fitLine(p, fieldText, 'medium', fieldWidth, FACT_MAX, FACT_MIN).size,
  );
  label('National ID', dx, rowB);
  p.draw(truncate(nicText, idWidth, (s) => p.width(s, pairSize, 'medium')), dx, rowB + 0.093, { size: pairSize, face: 'medium', color: BODY });
  label('Field', fieldX, rowB);
  p.draw(truncate(fieldText, fieldWidth, (s) => p.width(s, pairSize, 'medium')), fieldX, rowB + 0.093, { size: pairSize, face: 'medium', color: BODY });

  if (qualifications.length > 0) {
    const rowC = rowB + 0.205;
    label('Qualifications', dx, rowC);
    const pitch = 0.08;
    const first = rowC + 0.09;
    const bottomLimit = 1.69; // keep clear of the footer
    const room = Math.max(1, Math.min(2, Math.floor((bottomLimit - first) / pitch) + 1));
    const packed = packQualifications(p, qualifications, dw, room, [5.8, 5.4, 5], (n) => `+${n} more`);
    packed.lines.forEach((line, i) => p.draw(line, dx, first + i * pitch, { size: packed.size, face: 'medium', color: BODY }));
  }

  // Footer: clearance status (left) and expiry (right).
  doc.setFillColor(TINT);
  doc.rect(0, 1.74, W, H - 1.74, 'F');
  hairline(0, W, 1.74);
  doc.setFillColor(ACCENT);
  doc.circle(M + 0.03, 1.875, 0.028, 'F');
  p.draw('CLEARED FOR SITE ACCESS', M + 0.12, 1.893, { size: 4.8, face: 'semibold', color: ACCENT, track: 0.012 });
  const untilWidth = p.draw(fmtDate(card.validUntil, true), W - M, 1.893, { size: 4.8, face: 'bold', color: INK, track: 0.012, align: 'right' });
  p.draw('VALID UNTIL', W - M - untilWidth - 0.07, 1.893, { size: 4.3, face: 'medium', color: MUTED, track: 0.012, align: 'right' });

  // ════════════════════════════════ BACK ═════════════════════════════════════
  doc.addPage([W, H], 'landscape');
  accentRule();

  p.draw('SCAN TO REPORT A SAFETY CASE', M, 0.23, { size: 5.2, face: 'bold', color: INK, track: 0.016 });
  p.draw(card.cardNumber, W - M, 0.23, { size: 5, face: 'medium', color: MUTED, track: 0.012, align: 'right' });
  hairline(M, W - M, 0.32);

  // QR code in a quiet frame.
  const qrFrame = 1.24;
  const qrPad = 0.09;
  const qrY = 0.44;
  doc.setDrawColor(HAIR);
  doc.setLineWidth(0.01);
  doc.rect(M, qrY, qrFrame, qrFrame, 'S');
  const qr = await QRCode.toDataURL(qrUrl, { margin: 0, width: 480, errorCorrectionLevel: 'M', color: { dark: INK, light: '#FFFFFF' } });
  doc.addImage(qr, 'PNG', M + qrPad, qrY + qrPad, qrFrame - 2 * qrPad, qrFrame - 2 * qrPad);

  const bx = M + qrFrame + 0.2;
  const bw = W - M - bx;

  // Contractor contact person.
  label('Contractor contact', bx, 0.46);
  const contact = fitLine(p, card.contactPersonName || '—', 'bold', bw, 7.2, 5.4);
  p.draw(contact.text, bx, 0.585, { size: contact.size, face: 'bold', color: INK });
  const role = fitLine(p, card.contactPersonDesignation || '—', 'medium', bw, 5.6, 4.5);
  p.draw(role.text, bx, 0.68, { size: role.size, face: 'medium', color: BODY });
  const phone = fitLine(p, card.contactPersonPhone || '—', 'semibold', bw, 6.4, 4.8);
  p.draw(phone.text, bx, 0.78, { size: phone.size, face: 'semibold', color: INK });
  hairline(bx, W - M, 0.87);

  // Training it certifies.
  label('Safety induction', bx, 0.99);
  const training = fitLine(p, card.moduleTitle || '—', 'semibold', bw, 6, 4.6);
  p.draw(training.text, bx, 1.083, { size: training.size, face: 'semibold', color: INK });
  p.draw(`Issued ${fmtDate(card.issuedAt)}`, bx, 1.165, { size: 4.8, face: 'medium', color: MUTED });
  hairline(bx, W - M, 1.25);

  // Authorisation: the signature of whoever signed the training off.
  label('Authorised by', bx, 1.35);
  if (card.signatureDataUrl) imageContain(doc, card.signatureDataUrl, bx, 1.375, 0.95, 0.24, 'left');
  doc.setDrawColor('#94A3B8');
  doc.setLineWidth(0.008);
  doc.line(bx, 1.64, bx + 1.25, 1.64);
  const signer = fitLine(p, card.signedOffByName || card.issuedByName || '—', 'bold', bw, 5.8, 4.6);
  p.draw(signer.text, bx, 1.73, { size: signer.size, face: 'bold', color: INK });
  if (card.signedOffByTitle) {
    const title = fitLine(p, card.signedOffByTitle, 'medium', bw, 4.8, 4);
    p.draw(title.text, bx, 1.81, { size: title.size, face: 'medium', color: MUTED });
  }

  // Fine print.
  p.draw('Carry this card on site and show it on request.', M, 1.92, { size: 4, face: 'medium', color: MUTED });
  p.draw('Generated by FirmiCore · firmicore.com', W - M, 1.92, { size: 4, face: 'medium', color: MUTED, align: 'right' });

  return doc;
}

export function safetyCardFileName(card: Pick<ContractorSafetyCard, 'holderName' | 'cardNumber'>): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
  return `safety-card_${clean(card.holderName) || 'holder'}_${clean(card.cardNumber) || 'card'}.pdf`;
}
