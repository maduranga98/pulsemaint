import type { jsPDF } from 'jspdf';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';

/**
 * Shared drawing kit for the navy/sky-blue certificate design (the
 * "Professional Certificate Template": Classic A4 landscape for training
 * certificates, the A4 portrait layout for Trainee Programme certificates).
 *
 * Every coordinate/size is written in the template's own CSS pixels (A4 at
 * 96dpi: 1123×794 landscape, 794×1123 portrait) and scaled to PDF points by
 * `K`, so the layouts below can be read side by side with the template.
 */

/** CSS px → PDF pt (A4 is 841.89pt wide vs 1123px in the template). */
export const K = 841.89 / 1123;

export const NAVY = '#0B2A5B';
export const ACCENT = '#6EC1F2';
export const INK = '#0B0D12';
export const MUTED = '#3A4150';
export const FOOTER_LABEL = '#8FD3FF';

type FontKey = 'cinzel' | 'cormorantItalic' | 'manrope' | 'manropeSemi' | 'manropeBold' | 'pinyon' | 'noto' | 'notoBold';

const FONT_FILES: Record<FontKey, { file: string; family: string; style: string }> = {
  cinzel: { file: '/fonts/certificate/Cinzel-Bold.ttf', family: 'Cinzel', style: 'bold' },
  cormorantItalic: { file: '/fonts/certificate/CormorantGaramond-MediumItalic.ttf', family: 'Cormorant', style: 'italic' },
  manrope: { file: '/fonts/certificate/Manrope-Regular.ttf', family: 'Manrope', style: 'normal' },
  manropeSemi: { file: '/fonts/certificate/Manrope-SemiBold.ttf', family: 'ManropeSemi', style: 'normal' },
  manropeBold: { file: '/fonts/certificate/Manrope-Bold.ttf', family: 'Manrope', style: 'bold' },
  pinyon: { file: '/fonts/certificate/PinyonScript-Regular.ttf', family: 'Pinyon', style: 'normal' },
  // Fallback for names/text outside the design fonts' Latin coverage.
  noto: { file: '/fonts/NotoSans-Regular.ttf', family: 'NotoSans', style: 'normal' },
  notoBold: { file: '/fonts/NotoSans-Bold.ttf', family: 'NotoSans', style: 'bold' },
};

// Built-in jsPDF fonts used when a font file can't be fetched (offline,
// tests) — the certificate still generates, just without the design fonts.
const BUILTIN_FALLBACK: Record<FontKey, [string, string]> = {
  cinzel: ['times', 'bold'],
  cormorantItalic: ['times', 'italic'],
  manrope: ['helvetica', 'normal'],
  manropeSemi: ['helvetica', 'bold'],
  manropeBold: ['helvetica', 'bold'],
  pinyon: ['times', 'bolditalic'],
  noto: ['helvetica', 'normal'],
  notoBold: ['helvetica', 'bold'],
};

const fontDataCache = new Map<FontKey, Promise<string | null>>();

async function fetchFontBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

function loadFont(key: FontKey): Promise<string | null> {
  let p = fontDataCache.get(key);
  if (!p) {
    p = fetchFontBase64(FONT_FILES[key].file).then((data) => {
      // Don't cache a failure — a later download can retry.
      if (!data) fontDataCache.delete(key);
      return data;
    });
    fontDataCache.set(key, p);
  }
  return p;
}

/** A jsPDF document plus which design fonts actually registered on it. */
export interface CertificateCanvas {
  doc: jsPDF;
  loaded: Set<FontKey>;
}

export async function registerCertificateFonts(doc: jsPDF): Promise<CertificateCanvas> {
  const loaded = new Set<FontKey>();
  const keys = Object.keys(FONT_FILES) as FontKey[];
  const data = await Promise.all(keys.map(loadFont));
  keys.forEach((key, i) => {
    const b64 = data[i];
    if (!b64) return;
    const { file, family, style } = FONT_FILES[key];
    const vfsName = file.split('/').pop()!;
    try {
      doc.addFileToVFS(vfsName, b64);
      doc.addFont(vfsName, family, style);
      loaded.add(key);
    } catch {
      // Unusable font file — the built-in fallback covers this key.
    }
  });
  return { doc, loaded };
}

// The design fonts are Latin subsets (Basic Latin + Latin-1 + a little
// punctuation); anything beyond that is drawn in Noto Sans instead so it
// never renders as blank/garbled glyphs.
function isDesignFontSafe(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0xff && !(code >= 0x2010 && code <= 0x2044)) return false;
  }
  return true;
}

export function setFont(c: CertificateCanvas, key: FontKey, text = ''): void {
  let use = key;
  if (text && !isDesignFontSafe(text)) {
    use = key === 'manropeBold' || key === 'manropeSemi' || key === 'cinzel' ? 'notoBold' : 'noto';
  }
  if (c.loaded.has(use)) {
    c.doc.setFont(FONT_FILES[use].family, FONT_FILES[use].style);
  } else {
    const [family, style] = BUILTIN_FALLBACK[use];
    c.doc.setFont(family, style);
  }
}

// ---------------------------------------------------------------------------
// Shapes (template px in, PDF pt out)
// ---------------------------------------------------------------------------

export function polygon(c: CertificateCanvas, points: [number, number][], color: string, opacity = 1): void {
  const { doc } = c;
  const [x0, y0] = points[0];
  const deltas: [number, number][] = points.slice(1).map(([x, y], i) => {
    const [px, py] = points[i];
    return [(x - px) * K, (y - py) * K];
  });
  if (opacity < 1) doc.setGState(doc.GState({ opacity }));
  doc.setFillColor(color);
  doc.lines(deltas, x0 * K, y0 * K, [1, 1], 'F', true);
  if (opacity < 1) doc.setGState(doc.GState({ opacity: 1 }));
}

/** Clip everything drawn in `draw` to the given px rectangle (like an <svg> box). */
export function clipped(c: CertificateCanvas, x: number, y: number, w: number, h: number, draw: () => void): void {
  const { doc } = c;
  doc.saveGraphicsState();
  doc.rect(x * K, y * K, w * K, h * K, null);
  doc.clip();
  doc.discardPath();
  draw();
  doc.restoreGraphicsState();
}

export function strokeRect(c: CertificateCanvas, x: number, y: number, w: number, h: number, color: string, widthPx: number): void {
  c.doc.setDrawColor(color);
  c.doc.setLineWidth(widthPx * K);
  c.doc.rect(x * K, y * K, w * K, h * K, 'S');
}

export function fillRect(c: CertificateCanvas, x: number, y: number, w: number, h: number, color: string): void {
  c.doc.setFillColor(color);
  c.doc.rect(x * K, y * K, w * K, h * K, 'F');
}

export function circle(c: CertificateCanvas, cx: number, cy: number, r: number, fill: string): void {
  c.doc.setFillColor(fill);
  c.doc.circle(cx * K, cy * K, r * K, 'F');
}

/** Diamond divider: two rules with a small rotated square between them. */
export function diamondDivider(c: CertificateCanvas, cx: number, y: number, ruleWidth: number): void {
  fillRect(c, cx - 10 - ruleWidth, y, ruleWidth, 1, INK);
  fillRect(c, cx + 10, y, ruleWidth, 1, INK);
  polygon(c, [[cx, y - 5.6], [cx + 5.6, y], [cx, y + 5.6], [cx - 5.6, y]], ACCENT);
}

/**
 * The template's rosette: navy disc, dotted accent ring, ink core, star and
 * "EXCELLENCE". The portrait layout's version sits on a white rim (r=64) with
 * each ring 1px tighter; the landscape one has no rim.
 */
export function seal(c: CertificateCanvas, cx: number, cy: number, withWhiteRim = false): void {
  const inset = withWhiteRim ? 1 : 0;
  if (withWhiteRim) circle(c, cx, cy, 64, '#FFFFFF');
  circle(c, cx, cy, 58 - inset, NAVY);
  c.doc.setDrawColor(ACCENT);
  c.doc.setLineWidth(1.5 * K);
  c.doc.setLineDashPattern([2 * K, 3 * K], 0);
  c.doc.circle(cx * K, cy * K, (50 - inset) * K, 'S');
  c.doc.setLineDashPattern([], 0);
  circle(c, cx, cy, 40 - inset, INK);
  const star: [number, number][] = [
    [0, -18], [2.94, -10.05], [11.41, -9.71], [4.76, -4.45], [7.05, 3.71],
    [0, -1], [-7.05, 3.71], [-4.76, -4.45], [-11.41, -9.71], [-2.94, -10.05],
  ];
  polygon(c, star.map(([x, y]) => [cx + x, cy + y]), ACCENT);
  spacedText(c, 'EXCELLENCE', cx, cy + 16, { key: 'manropeBold', size: 8.5, spacing: 1.5, color: '#FFFFFF' });
}

/** Small hexagon brand mark used when the company has no logo. */
export function hexMark(c: CertificateCanvas, x: number, y: number, outer: string, inner: string, outline = false): void {
  const big: [number, number][] = [[15, 1], [28, 8], [28, 22], [15, 29], [2, 22], [2, 8]];
  const small: [number, number][] = [[15, 8], [22, 12], [22, 18], [15, 22], [8, 18], [8, 12]];
  const at = (pts: [number, number][]) => pts.map(([px, py]) => [x + px, y + py] as [number, number]);
  if (outline) {
    c.doc.setDrawColor(outer);
    c.doc.setLineWidth(1.5 * K);
    const pts = at(big);
    const deltas = pts.slice(1).map(([px, py], i) => [(px - pts[i][0]) * K, (py - pts[i][1]) * K] as [number, number]);
    c.doc.lines(deltas, pts[0][0] * K, pts[0][1] * K, [1, 1], 'S', true);
  } else {
    polygon(c, at(big), outer);
  }
  polygon(c, at(small), inner);
}

/** Draws an image scaled to fit (contain) a px box. Returns false if the image couldn't be drawn. */
export function imageContain(c: CertificateCanvas, dataUrl: string, x: number, y: number, w: number, h: number): boolean {
  try {
    const props = c.doc.getImageProperties(dataUrl);
    const ratio = Math.min(w / props.width, h / props.height);
    const dw = props.width * ratio;
    const dh = props.height * ratio;
    c.doc.addImage(dataUrl, imageFormatFromDataUrl(dataUrl), (x + (w - dw) / 2) * K, (y + (h - dh) / 2) * K, dw * K, dh * K);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

interface TextStyle {
  key: FontKey;
  /** Font size in template px. */
  size: number;
  /** CSS letter-spacing in template px. */
  spacing?: number;
  color: string;
}

// Scripts that need OpenType shaping (Sinhala, Tamil, Devanagari, Arabic,
// Thai, CJK…) can't be drawn by jsPDF, and none of the embedded fonts cover
// them. Text like that — typically a trainee's or company's name — is drawn
// with the browser's own text engine onto a canvas and embedded as a
// high-resolution image instead, so it still appears correctly shaped.
function needsRaster(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0530 && !(code >= 0x1e00 && code <= 0x206f) && !(code >= 0x20a0 && code <= 0x20cf)) return true;
  }
  return false;
}

const RASTER_SCALE = 4;

function canvasFont(style: TextStyle): string {
  const bold = style.key === 'manropeBold' || style.key === 'manropeSemi' || style.key === 'cinzel';
  const italic = style.key === 'cormorantItalic' || style.key === 'pinyon';
  const family = style.key === 'cinzel' || style.key === 'cormorantItalic' || style.key === 'pinyon' ? 'serif' : 'sans-serif';
  // Pinyon Script's sizes are optically tiny; a regular face at the same px
  // size would dwarf the layout, so script-styled text is drawn smaller.
  const size = style.key === 'pinyon' ? style.size * 0.6 : style.size;
  return `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${size * RASTER_SCALE}px ${family}`;
}

function rasterContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null;
  }
}

function rasterMeasure(text: string, style: TextStyle): number | null {
  if (!needsRaster(text)) return null;
  const ctx = rasterContext();
  if (!ctx) return null;
  ctx.font = canvasFont(style);
  return ctx.measureText(text).width / RASTER_SCALE + (style.spacing ?? 0) * [...text].length;
}

function drawRasterText(c: CertificateCanvas, text: string, left: number, cy: number, style: TextStyle): boolean {
  if (!needsRaster(text)) return false;
  const ctx = rasterContext();
  if (!ctx) return false;
  ctx.font = canvasFont(style);
  const widthPx = Math.ceil(ctx.measureText(text).width) + 8;
  const heightPx = Math.ceil((style.key === 'pinyon' ? style.size * 0.6 : style.size) * RASTER_SCALE * 1.8);
  const canvas = ctx.canvas;
  canvas.width = widthPx;
  canvas.height = heightPx;
  // Resizing resets the context state.
  ctx.font = canvasFont(style);
  ctx.fillStyle = style.color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 4, heightPx / 2);
  try {
    const w = widthPx / RASTER_SCALE;
    const h = heightPx / RASTER_SCALE;
    c.doc.addImage(canvas.toDataURL('image/png'), 'PNG', (left - 1) * K, (cy - h / 2) * K, w * K, h * K);
    return true;
  } catch {
    return false;
  }
}

/** Width in template px of `text` in the given style (letter-spacing included, like CSS). */
export function textWidth(c: CertificateCanvas, text: string, style: TextStyle): number {
  const raster = rasterMeasure(text, style);
  if (raster !== null) return raster;
  setFont(c, style.key, text);
  c.doc.setFontSize(style.size * K);
  const spacing = style.spacing ?? 0;
  return c.doc.getTextWidth(text) / K + spacing * [...text].length;
}

/**
 * Letter-spaced single line, vertically centred on `cy`. `align` positions
 * the line's box at `x` like CSS text-align would.
 */
export function spacedText(
  c: CertificateCanvas,
  text: string,
  x: number,
  cy: number,
  style: TextStyle,
  align: 'center' | 'left' | 'right' = 'center',
): number {
  const w = textWidth(c, text, style);
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (drawRasterText(c, text, left, cy, style)) return w;
  setFont(c, style.key, text);
  c.doc.setFontSize(style.size * K);
  c.doc.setTextColor(style.color);
  c.doc.text(text, left * K, cy * K, { baseline: 'middle', charSpace: (style.spacing ?? 0) * K });
  return w;
}

/** Shrinks the font size until `text` fits `maxWidth` px (never below `minSize`). */
export function fitSize(c: CertificateCanvas, text: string, style: TextStyle, maxWidth: number, minSize: number): number {
  let size = style.size;
  while (size > minSize && textWidth(c, text, { ...style, size }) > maxWidth) size -= 1;
  return size;
}

/** Shortens `text` with an ellipsis until it fits `maxWidth` px. */
export function truncate(c: CertificateCanvas, text: string, style: TextStyle, maxWidth: number): string {
  if (textWidth(c, text, style) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(c, `${out}…`, style) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

export interface TextRun {
  text: string;
  key: FontKey;
  color: string;
}

/**
 * Centred paragraph built from mixed-weight runs (e.g. body text with a bold
 * programme name), word-wrapped to `maxWidth` px. Returns the y (px) just
 * below the last line. Lines past `maxLines` are dropped, ending in "…".
 */
export function richParagraph(
  c: CertificateCanvas,
  runs: TextRun[],
  cx: number,
  firstLineCy: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  maxLines = 4,
): number {
  type Word = { text: string; run: TextRun; space: boolean };
  const words: Word[] = [];
  runs.forEach((run) => {
    run.text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        if (words.length) words[words.length - 1].space = true;
      } else {
        words.push({ text: part, run, space: false });
      }
    });
  });

  const width = (w: Word) => textWidth(c, w.text, { key: w.run.key, size, color: w.run.color });
  const spaceW = textWidth(c, ' ', { key: 'manrope', size, color: INK });

  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineW = 0;
  words.forEach((w) => {
    const prev = line[line.length - 1];
    const add = (prev?.space ? spaceW : 0) + width(w);
    if (line.length && lineW + add > maxWidth) {
      lines.push(line);
      line = [w];
      lineW = width(w);
    } else {
      line.push(w);
      lineW += add;
    }
  });
  if (line.length) lines.push(line);

  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const last = shown[shown.length - 1];
    last[last.length - 1] = { ...last[last.length - 1], text: `${last[last.length - 1].text}…` };
  }

  shown.forEach((ln, i) => {
    const total = ln.reduce((sum, w, j) => sum + width(w) + (j > 0 && ln[j - 1].space ? spaceW : 0), 0);
    let x = cx - total / 2;
    const cy = firstLineCy + i * lineHeight;
    ln.forEach((w, j) => {
      if (j > 0 && ln[j - 1].space) x += spaceW;
      x += spacedText(c, w.text, x, cy, { key: w.run.key, size, color: w.run.color }, 'left');
    });
  });
  return firstLineCy + (shown.length - 1) * lineHeight + lineHeight / 2;
}

/** Signature block: optional captured signature above a rule, then name and caption. */
export function signatureBlock(
  c: CertificateCanvas,
  left: number,
  width: number,
  ruleY: number,
  name: string,
  caption: string,
  signatureImageDataUrl?: string | null,
): void {
  const cx = left + width / 2;
  if (signatureImageDataUrl) {
    imageContain(c, signatureImageDataUrl, cx - 80, ruleY - 50, 160, 44);
  }
  fillRect(c, left, ruleY, width, 1, INK);
  const nameStyle = { key: 'manropeBold' as const, size: 14, color: INK };
  const nameSize = fitSize(c, name || '—', nameStyle, width, 10);
  const nameText = truncate(c, name || '—', { ...nameStyle, size: nameSize }, width);
  spacedText(c, nameText, cx, ruleY + 20.5, { ...nameStyle, size: nameSize });
  const cap = truncate(c, caption.toUpperCase(), { key: 'manropeSemi', size: 11, spacing: 2, color: MUTED }, width + 20);
  spacedText(c, cap, cx, ruleY + 41.5, { key: 'manropeSemi', size: 11, spacing: 2, color: MUTED });
}

export function formatCertificateDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}
