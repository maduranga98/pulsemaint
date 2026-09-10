import type { jsPDF } from 'jspdf';

/**
 * jsPDF's built-in fonts (Helvetica/Times/Courier) only support the WinAnsi
 * (roughly Latin-1) character set. Any translated label containing glyphs
 * outside that set — Chinese/Japanese in particular — renders as corrupted
 * garbage (mis-mapped glyph IDs) instead of visible text. NotoSans covers
 * Latin Extended, Cyrillic, Greek, and Vietnamese, which is enough for every
 * currently supported language except zh/ja (see `pdfSafeText` below for how
 * those are handled without embedding a multi-megabyte CJK font).
 */
const FONT_NAME = 'NotoSans';

let fontDataPromise: Promise<{ regular: string; bold: string }> | null = null;

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
  const buffer = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function loadFontData(): Promise<{ regular: string; bold: string }> {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all([
      fetchFontBase64('/fonts/NotoSans-Regular.ttf'),
      fetchFontBase64('/fonts/NotoSans-Bold.ttf'),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontDataPromise;
}

/**
 * Registers the Unicode-capable NotoSans font on the given jsPDF document and
 * sets it as the active font. Falls back silently to jsPDF's default font
 * (still fine for plain English/ASCII reports) if the font can't be fetched
 * — e.g. offline — so report generation never hard-fails over this.
 */
export async function registerUnicodeFont(doc: jsPDF): Promise<string> {
  try {
    const { regular, bold } = await loadFontData();
    doc.addFileToVFS('NotoSans-Regular.ttf', regular);
    doc.addFont('NotoSans-Regular.ttf', FONT_NAME, 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', bold);
    doc.addFont('NotoSans-Bold.ttf', FONT_NAME, 'bold');
    doc.setFont(FONT_NAME, 'normal');
    return FONT_NAME;
  } catch {
    return 'helvetica';
  }
}

/**
 * NotoSans covers Latin (incl. Extended-A/B), Cyrillic, Greek, and
 * Vietnamese — everything up to roughly U+02FF plus a handful of higher
 * Latin Extended Additional characters, but not CJK. Text outside that
 * range (Chinese/Japanese translations) would render as missing-glyph boxes
 * or corrupted output with jsPDF's embeddable font set, so callers should
 * use `pdfSafeText` to fall back to the English label instead of shipping a
 * PDF with unreadable text — the Excel export already renders CJK correctly
 * since it has no font-embedding step.
 */
function isRenderableWithNotoSans(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2fff) return false;
  }
  return true;
}

/**
 * Returns `text` if every character in it is renderable with the embedded
 * NotoSans font, otherwise returns `fallback` (normally the English source
 * string). Use this for every translated string drawn into a jsPDF document.
 */
export function pdfSafeText(text: string, fallback: string): string {
  return isRenderableWithNotoSans(text) ? text : fallback;
}
