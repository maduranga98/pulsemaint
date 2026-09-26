import type { jsPDF } from 'jspdf';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';

/**
 * Shared drawing kit for the navy "wave" certificate designs: the A4 portrait
 * Trainee Programme certificate (wave header) and the A4 landscape training
 * certificate (curved side panel). Both share the Montserrat / Playfair
 * Display type, the teal check-marked module list and the gold award seal.
 *
 * Coordinates and sizes are written in A4 CSS pixels (96dpi: 794×1123
 * portrait, 1123×794 landscape) and scaled to PDF points by `K`.
 */

/** CSS px → PDF pt (A4 is 841.89pt wide vs 1123px). */
export const K = 841.89 / 1123;

export const NAVY = '#133A5C';
export const INK = '#1B2433';
export const MUTED = '#4A5363';
export const TEAL = '#22B5CE';
export const LIGHT_TEAL = '#5CCBE6';
export const PAPER = '#F4F6F9';
export const WAVE_LIGHT = '#FFFFFF';
export const WAVE_SHADE = '#EAEEF2';
const GOLD_DARK = '#C8932F';
const GOLD_LIGHT = '#EDC263';

type FontKey = 'display' | 'bold' | 'semi' | 'medium' | 'script' | 'noto' | 'notoBold';

const FONT_FILES: Record<FontKey, { file: string; family: string; style: string }> = {
  display: { file: '/fonts/certificate/Montserrat-ExtraBold.ttf', family: 'MontserratX', style: 'bold' },
  bold: { file: '/fonts/certificate/Montserrat-Bold.ttf', family: 'Montserrat', style: 'bold' },
  semi: { file: '/fonts/certificate/Montserrat-SemiBold.ttf', family: 'MontserratSemi', style: 'normal' },
  medium: { file: '/fonts/certificate/Montserrat-Medium.ttf', family: 'Montserrat', style: 'normal' },
  script: { file: '/fonts/certificate/PlayfairDisplay-BoldItalic.ttf', family: 'Playfair', style: 'bolditalic' },
  // Fallback for text outside the design fonts' Latin coverage.
  noto: { file: '/fonts/NotoSans-Regular.ttf', family: 'NotoSans', style: 'normal' },
  notoBold: { file: '/fonts/NotoSans-Bold.ttf', family: 'NotoSans', style: 'bold' },
};

// Built-in jsPDF fonts used when a font file can't be fetched (offline,
// tests) — the certificate still generates, just without the design fonts.
const BUILTIN_FALLBACK: Record<FontKey, [string, string]> = {
  display: ['helvetica', 'bold'],
  bold: ['helvetica', 'bold'],
  semi: ['helvetica', 'bold'],
  medium: ['helvetica', 'normal'],
  script: ['times', 'bolditalic'],
  noto: ['helvetica', 'normal'],
  notoBold: ['helvetica', 'bold'],
};

const BOLD_KEYS = new Set<FontKey>(['display', 'bold', 'semi', 'script']);

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
  if (text && !isDesignFontSafe(text)) use = BOLD_KEYS.has(key) ? 'notoBold' : 'noto';
  if (c.loaded.has(use)) {
    c.doc.setFont(FONT_FILES[use].family, FONT_FILES[use].style);
  } else {
    const [family, style] = BUILTIN_FALLBACK[use];
    c.doc.setFont(family, style);
  }
}

// ---------------------------------------------------------------------------
// Shapes (px in, PDF pt out)
// ---------------------------------------------------------------------------

export type PathCmd = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number];

/** Fills a closed path made of straight and cubic-Bézier segments (absolute px, like SVG M/L/C). */
export function fillPath(c: CertificateCanvas, cmds: PathCmd[], color: string): void {
  const [, x0, y0] = cmds[0] as ['M', number, number];
  let cx = x0;
  let cy = y0;
  const segments: number[][] = [];
  cmds.slice(1).forEach((cmd) => {
    if (cmd[0] === 'L') {
      segments.push([(cmd[1] - cx) * K, (cmd[2] - cy) * K]);
      [cx, cy] = [cmd[1], cmd[2]];
    } else if (cmd[0] === 'C') {
      const [, x1, y1, x2, y2, x, y] = cmd;
      // jsPDF curve control points are relative to the segment's start.
      segments.push([(x1 - cx) * K, (y1 - cy) * K, (x2 - cx) * K, (y2 - cy) * K, (x - cx) * K, (y - cy) * K]);
      [cx, cy] = [x, y];
    }
  });
  c.doc.setFillColor(color);
  c.doc.lines(segments, x0 * K, y0 * K, [1, 1], 'F', true);
}

export function polygon(c: CertificateCanvas, points: [number, number][], color: string): void {
  fillPath(c, [['M', ...points[0]], ...points.slice(1).map(([x, y]) => ['L', x, y] as PathCmd)], color);
}

export function fillRect(c: CertificateCanvas, x: number, y: number, w: number, h: number, color: string): void {
  c.doc.setFillColor(color);
  c.doc.rect(x * K, y * K, w * K, h * K, 'F');
}

export function circle(c: CertificateCanvas, cx: number, cy: number, r: number, fill: string): void {
  c.doc.setFillColor(fill);
  c.doc.circle(cx * K, cy * K, r * K, 'F');
}

function star(c: CertificateCanvas, cx: number, cy: number, r: number, color: string): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  polygon(c, pts, color);
}

/** Teal disc with a white tick — the module-list bullet. */
export function checkBadge(c: CertificateCanvas, cx: number, cy: number, r = 8): void {
  circle(c, cx, cy, r, TEAL);
  c.doc.setDrawColor('#FFFFFF');
  c.doc.setLineWidth(r * 0.24 * K);
  c.doc.setLineCap('round');
  c.doc.setLineJoin('round');
  const s = r / 8;
  c.doc.lines(
    [[3 * s * K, 3 * s * K], [5.6 * s * K, -6 * s * K]],
    (cx - 3.8 * s) * K,
    (cy + 0.2 * s) * K,
    [1, 1],
    'S',
    false,
  );
  c.doc.setLineCap('butt');
  c.doc.setLineJoin('miter');
}

/**
 * Gold award rosette: two navy ribbon tails, a bevelled gold ring, navy disc
 * with a dotted gold ring, a star, the award year and "AWARD". `scale` 1 is
 * the portrait size (r=64px).
 */
export function awardSeal(c: CertificateCanvas, cx: number, cy: number, year: string, scale = 1): void {
  const s = scale;
  const at = (pts: [number, number][]) => pts.map(([x, y]) => [cx + x * s, cy + y * s] as [number, number]);
  polygon(c, at([[-38, 46], [-10, 50], [-18, 108], [-30, 94], [-46, 106]]), NAVY);
  polygon(c, at([[10, 50], [38, 46], [46, 106], [30, 94], [18, 108]]), INK);

  circle(c, cx, cy, 64 * s, GOLD_DARK);
  circle(c, cx - 1.6 * s, cy - 1.6 * s, 61.5 * s, GOLD_LIGHT);
  circle(c, cx, cy, 56 * s, NAVY);
  c.doc.setDrawColor(GOLD_LIGHT);
  c.doc.setLineWidth(1.1 * s * K);
  c.doc.setLineDashPattern([1.6 * s * K, 2.6 * s * K], 0);
  c.doc.circle(cx * K, cy * K, 50 * s * K, 'S');
  c.doc.setLineDashPattern([], 0);

  star(c, cx, cy - 22 * s, 7 * s, GOLD_LIGHT);
  spacedText(c, year, cx, cy + 3 * s, { key: 'display', size: 19 * s, color: GOLD_LIGHT });
  spacedText(c, 'AWARD', cx, cy + 24 * s, { key: 'bold', size: 7.5 * s, spacing: 2 * s, color: '#FFFFFF' });
}

/** Hexagon brand mark (teal outline around a white hexagon) used when the company has no logo. */
export function hexMark(c: CertificateCanvas, cx: number, cy: number, size: number): void {
  const hex = (r: number) => Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
  const outer = hex(size / 2);
  c.doc.setDrawColor(LIGHT_TEAL);
  c.doc.setLineWidth((size / 16) * K);
  c.doc.setLineJoin('round');
  const deltas = outer.slice(1).map(([x, y], i) => [(x - outer[i][0]) * K, (y - outer[i][1]) * K]);
  c.doc.lines(deltas, outer[0][0] * K, outer[0][1] * K, [1, 1], 'S', true);
  c.doc.setLineJoin('miter');
  polygon(c, hex(size * 0.26), '#FFFFFF');
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

/** Company logo on a white rounded tile (so dark logos stay visible on navy), or the hex mark. */
export function brandMark(c: CertificateCanvas, cx: number, cy: number, size: number, logo?: string | null): void {
  if (logo) {
    c.doc.setFillColor('#FFFFFF');
    c.doc.roundedRect((cx - size / 2) * K, (cy - size / 2) * K, size * K, size * K, 6 * K, 6 * K, 'F');
    if (imageContain(c, logo, cx - size / 2 + 4, cy - size / 2 + 4, size - 8, size - 8)) return;
    // Unreadable logo — fall through to the hex mark on the navy background.
    circle(c, cx, cy, size / 2 + 1, NAVY);
  }
  hexMark(c, cx, cy, Math.min(size, 44));
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TextStyle {
  key: FontKey;
  /** Font size in px. */
  size: number;
  /** CSS letter-spacing in px. */
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

function rasterSize(style: TextStyle): number {
  // The script face's size is set for Latin display type; a regular face at
  // the same size would dwarf the layout, so script-styled text is smaller.
  return style.key === 'script' ? style.size * 0.75 : style.size;
}

function canvasFont(style: TextStyle): string {
  const bold = BOLD_KEYS.has(style.key) || style.key === 'notoBold';
  const italic = style.key === 'script';
  const family = style.key === 'script' ? 'serif' : 'sans-serif';
  return `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${rasterSize(style) * RASTER_SCALE}px ${family}`;
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
  const heightPx = Math.ceil(rasterSize(style) * RASTER_SCALE * 1.8);
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

/** Width in px of `text` in the given style (letter-spacing included, like CSS). */
export function textWidth(c: CertificateCanvas, text: string, style: TextStyle): number {
  const raster = rasterMeasure(text, style);
  if (raster !== null) return raster;
  setFont(c, style.key, text);
  c.doc.setFontSize(style.size * K);
  return c.doc.getTextWidth(text) / K + (style.spacing ?? 0) * [...text].length;
}

/**
 * Letter-spaced single line, vertically centred on `cy`. `align` positions
 * the line's box at `x` like CSS text-align would. Returns the width drawn.
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

/** Word-wraps `text` to `maxWidth` px, at most `maxLines` lines (the last ends in "…" if cut). */
export function wrapLines(c: CertificateCanvas, text: string, style: TextStyle, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(c, next, style) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines.map((l) => truncate(c, l, style, maxWidth));
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = truncate(c, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, style, maxWidth);
  return kept;
}

/** Checklist item: teal tick badge followed by the label, truncated to `width`. */
export function checkItem(c: CertificateCanvas, x: number, cy: number, label: string, width: number, size = 13): void {
  checkBadge(c, x + 8, cy, 8);
  const style = { key: 'medium' as const, size, color: INK };
  spacedText(c, truncate(c, label, style, width - 28), x + 26, cy, style, 'left');
}

/**
 * Footer block in the design's style: value (date or signatory name) above a
 * rule, spaced caption below. A captured signature is drawn above the name.
 */
export function footerBlock(
  c: CertificateCanvas,
  cx: number,
  width: number,
  ruleY: number,
  value: string,
  caption: string,
  signatureImageDataUrl?: string | null,
): void {
  if (signatureImageDataUrl) imageContain(c, signatureImageDataUrl, cx - 75, ruleY - 68, 150, 40);
  const valueStyle = { key: 'bold' as const, size: 14.5, color: INK };
  const size = fitSize(c, value || '—', valueStyle, width, 10);
  spacedText(c, truncate(c, value || '—', { ...valueStyle, size }, width), cx, ruleY - 18, { ...valueStyle, size });
  fillRect(c, cx - width / 2, ruleY, width, 1, INK);
  const capStyle = { key: 'semi' as const, size: 10.5, spacing: 3.5, color: MUTED };
  spacedText(c, truncate(c, caption.toUpperCase(), capStyle, width + 30), cx, ruleY + 17, capStyle);
}

export function formatCertificateDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}
