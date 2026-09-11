import type { jsPDF } from 'jspdf';
import i18n from '../../../lib/i18n';

/**
 * jsPDF's built-in fonts (Helvetica/Times/Courier) only support the WinAnsi
 * (roughly Latin-1) character set. Any translated label containing glyphs
 * outside that set renders as corrupted garbage (mis-mapped glyph IDs)
 * instead of visible text, so every PDF export in this app embeds a real
 * Unicode TrueType font instead of using those built-ins.
 *
 * `NotoSans` covers Latin (incl. Extended-A/B), Cyrillic, Greek, and
 * Vietnamese — enough for es/fr/de and general free text. `NotoSansSC` and
 * `NotoSansJP` are subset embeddable fonts (~2.5MB each — a curated
 * GB2312/JIS "common characters" subset plus Latin/punctuation, not the
 * full ~10-20MB variable-weight release fonts) used only when the current
 * app language is zh/ja respectively, so a Chinese or Japanese PDF renders
 * its own script correctly instead of falling back to English or corrupting.
 */
const LATIN_FONT_NAME = 'NotoSans';
const SC_FONT_NAME = 'NotoSansSC';
const JP_FONT_NAME = 'NotoSansJP';

type FontVariant = 'latin' | 'sc' | 'jp';

const FONT_FILES: Record<FontVariant, { name: string; regular: string; bold: string }> = {
  latin: { name: LATIN_FONT_NAME, regular: '/fonts/NotoSans-Regular.ttf', bold: '/fonts/NotoSans-Bold.ttf' },
  sc: { name: SC_FONT_NAME, regular: '/fonts/NotoSansSC-Regular.ttf', bold: '/fonts/NotoSansSC-Bold.ttf' },
  jp: { name: JP_FONT_NAME, regular: '/fonts/NotoSansJP-Regular.ttf', bold: '/fonts/NotoSansJP-Bold.ttf' },
};

const fontDataCache = new Map<FontVariant, Promise<{ regular: string; bold: string }>>();

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

function loadFontData(variant: FontVariant): Promise<{ regular: string; bold: string }> {
  let promise = fontDataCache.get(variant);
  if (!promise) {
    const files = FONT_FILES[variant];
    promise = Promise.all([fetchFontBase64(files.regular), fetchFontBase64(files.bold)]).then(
      ([regular, bold]) => ({ regular, bold }),
    );
    fontDataCache.set(variant, promise);
  }
  return promise;
}

function variantForCurrentLanguage(): FontVariant {
  const lang = i18n.language ?? '';
  if (lang.startsWith('zh')) return 'sc';
  if (lang.startsWith('ja')) return 'jp';
  return 'latin';
}

let activeVariant: FontVariant = 'latin';

/**
 * Registers the Unicode-capable font matching the current app language on
 * the given jsPDF document and sets it as the active font, so an exported
 * PDF's script matches whatever language the app is currently set to
 * (falling back to the Latin NotoSans for every other supported language).
 * Falls back silently to jsPDF's default font (still fine for plain
 * English/ASCII reports) if the font can't be fetched — e.g. offline — so
 * report generation never hard-fails over this.
 */
export async function registerUnicodeFont(doc: jsPDF): Promise<string> {
  const variant = variantForCurrentLanguage();
  const { name } = FONT_FILES[variant];
  try {
    const { regular, bold } = await loadFontData(variant);
    doc.addFileToVFS(`${name}-Regular.ttf`, regular);
    doc.addFont(`${name}-Regular.ttf`, name, 'normal');
    doc.addFileToVFS(`${name}-Bold.ttf`, bold);
    doc.addFont(`${name}-Bold.ttf`, name, 'bold');
    doc.setFont(name, 'normal');
    activeVariant = variant;
    return name;
  } catch {
    activeVariant = 'latin';
    return 'helvetica';
  }
}

/**
 * Each embedded font's approximate Unicode coverage, used by `pdfSafeText`
 * below as a best-effort check — not an exact cmap lookup (the SC/JP fonts
 * are curated ~7,000-character subsets, not full CJK blocks, so a genuinely
 * rare character can still miss and render as a blank/tofu glyph instead of
 * corrupting the rest of the line, which is the failure mode this guards
 * against — see the two prior font-corruption bugs in Reports/Service
 * Letter PDF export for why an unguarded embed isn't enough on its own).
 */
function isRenderableWithActiveFont(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (activeVariant === 'sc') {
      const isCjk = code >= 0x4e00 && code <= 0x9fff;
      const isCjkPunct = code >= 0x3000 && code <= 0x303f;
      const isFullwidth = code >= 0xff00 && code <= 0xffef;
      if (code > 0x2fff && !isCjk && !isCjkPunct && !isFullwidth) return false;
    } else if (activeVariant === 'jp') {
      const isCjk = code >= 0x4e00 && code <= 0x9fff;
      const isKana = code >= 0x3040 && code <= 0x30ff;
      const isCjkPunct = code >= 0x3000 && code <= 0x303f;
      const isFullwidth = code >= 0xff00 && code <= 0xffef;
      if (code > 0x2fff && !isCjk && !isKana && !isCjkPunct && !isFullwidth) return false;
    } else if (code > 0x2fff) {
      return false;
    }
  }
  return true;
}

/**
 * Returns `text` if every character in it is renderable with the font
 * registered for the current app language, otherwise returns `fallback`
 * (normally the English source string). Use this for every translated
 * string drawn into a jsPDF document, after calling `registerUnicodeFont`.
 */
export function pdfSafeText(text: string, fallback: string): string {
  return isRenderableWithActiveFont(text) ? text : fallback;
}
