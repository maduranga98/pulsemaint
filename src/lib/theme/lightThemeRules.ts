// Builds the light-theme stylesheet for the app shell.
//
// The shell and many widgets are written with hard-coded dark-navy utility
// classes (bg-[#0F1E35], text-[#F0F4F8], border-[#1E3A5F] …). Rather than
// rewrite every component, the build scans the source for those class names
// and emits one override per class, active only under
// <html data-theme="light">. The dark theme is untouched: with no
// data-theme="light" on <html>, none of these rules match.
//
// Pure functions only — vite.config.ts feeds them the class names it finds,
// and src/lib/__tests__/lightThemeRules.test.ts pins the behaviour.

export const LIGHT = {
  page: '#EEF2F8',
  card: '#FFFFFF',
  raised: '#E6EDF8',
  track: '#DCE4F0',
  trackStrong: '#C3D0E4',
  line: '#DCE4F0',
  lineStrong: '#B9C7DD',
  ink: '#080D1C',
  inkSoft: '#0F1830',
  inkMuted: '#18223C',
  inkSubtle: '#222D47',
} as const;

/** Pale accent text that is unreadable on white → a deeper shade of the same hue. */
const INK_ACCENTS: Record<string, string> = {
  '#60A5FA': '#1D4ED8', '#93C5FD': '#1E40AF', '#5B8DEF': '#1A56DB', '#8DB8FF': '#1D4ED8', '#4C8DFF': '#1A56DB',
  '#00C2FF': '#005A8A', '#10B981': '#047857', '#34D399': '#047857', '#4ADE80': '#15803D', '#86EFAC': '#15803D',
  '#EF4444': '#DC2626', '#F87171': '#DC2626', '#FCA5A5': '#B91C1C', '#FECACA': '#B91C1C',
  '#F59E0B': '#B45309', '#FBBF24': '#B45309', '#FCD34D': '#B45309', '#FDE68A': '#92400E', '#EAB308': '#A16207',
  '#A78BFA': '#6D28D9',
};

type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb | null {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return n.some(Number.isNaN) ? null : (n as Rgb);
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const chroma = ([r, g, b]: Rgb) => Math.max(r, g, b) - Math.min(r, g, b);

/** Dark red / amber / green panels (danger, warning, success) → a soft tint of the same hue. */
function darkTint([r, g, b]: Rgb): string | null {
  if (r >= g && r > b) return g > b * 1.5 ? '#FEF3C7' : '#FDE8E8';
  if (g > r && g >= b) return '#DCF5E9';
  return null;
}

/** Light replacement for a background colour, or null when it should stay as it is. */
export function lightSurface(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const lum = luminance(rgb);
  if (lum >= 0.11 || chroma(rgb) > 100) return null; // accent or already light
  const tint = darkTint(rgb);
  if (tint) return lum < 0.07 ? tint : null;
  if (lum < 0.0125) return LIGHT.page;
  if (lum < 0.0175) return LIGHT.card;
  if (lum < 0.03) return LIGHT.raised;
  if (lum < 0.07) return LIGHT.track;
  return LIGHT.trackStrong;
}

/** Light replacement for a border / divider / ring colour. */
export function lightLine(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const lum = luminance(rgb);
  if (lum >= 0.11 || chroma(rgb) > 100) return null;
  const tint = darkTint(rgb);
  if (tint) return lum < 0.07 ? (tint === '#DCF5E9' ? '#86EFAC' : tint === '#FEF3C7' ? '#FCD34D' : '#FCA5A5') : null;
  return lum < 0.07 ? LIGHT.line : LIGHT.lineStrong;
}

/** Light replacement for a text / icon colour. */
export function lightInk(hex: string): string | null {
  const key = hex.toUpperCase();
  if (INK_ACCENTS[key]) return INK_ACCENTS[key];
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const lum = luminance(rgb);
  if (chroma(rgb) > 70) {
    if (lum < 0.3) return null; // already deep enough for a white page
    return '#' + rgb.map((v) => Math.round(v * 0.6).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  if (lum > 0.75) return LIGHT.ink;
  if (lum > 0.5) return LIGHT.inkSoft;
  if (lum > 0.3) return LIGHT.inkMuted;
  if (lum > 0.12) return LIGHT.inkSubtle;
  return null;
}

/** True for a solid background that keeps its colour and carries light text (buttons, badges). */
export function isAccentSurface(hex: string): boolean {
  const rgb = parseHex(hex);
  return !!rgb && lightSurface(hex) === null && luminance(rgb) < 0.4;
}

const NAMED_ACCENT_HUES = ['blue', 'indigo', 'sky', 'cyan', 'teal', 'emerald', 'green', 'lime', 'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'purple', 'violet', 'slate', 'gray', 'zinc', 'neutral', 'stone'];
const NAMED_ACCENT_SHADES = ['500', '600', '700', '800', '900', '950'];

export const TOKEN_PATTERN =
  /(?:[a-z-]+:)*(?:bg|text|border(?:-[trblxy])?|divide|ring-offset|ring|from|via|to|fill|stroke|outline|placeholder|accent|caret|decoration)-(?:\[#[0-9A-Fa-f]{3,8}\]|white)(?:\/\d{1,3})?!?(?![\w/[-])/g;

const MEDIA: Record<string, string> = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem', '2xl': '96rem' };
const PSEUDO: Record<string, string> = {
  hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible', 'focus-within': ':focus-within',
  active: ':active', disabled: ':disabled', placeholder: '::placeholder', file: '::file-selector-button',
};

export const escapeClass = (cls: string) => cls.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

type Role = 'surface' | 'line' | 'ink';
interface Parsed {
  token: string;
  variants: string[];
  utility: string;
  color: string; // '#RRGGBB' or 'white'
  alpha: number | null;
}

export function parseToken(token: string): Parsed | null {
  const m = /^((?:[a-z0-9-]+:)*)([a-z-]+?)-(\[#[0-9A-Fa-f]{3,8}\]|white)(?:\/(\d{1,3}))?$/.exec(token);
  if (!m) return null;
  return {
    token,
    variants: m[1] ? m[1].slice(0, -1).split(':') : [],
    utility: m[2],
    color: m[3] === 'white' ? 'white' : m[3].slice(1, -1),
    alpha: m[4] ? Number(m[4]) : null,
  };
}

const ROLE: Record<string, Role> = {
  bg: 'surface', from: 'surface', via: 'surface', to: 'surface',
  border: 'line', divide: 'line', ring: 'line', 'ring-offset': 'surface', outline: 'line',
  text: 'ink', placeholder: 'ink', fill: 'ink', stroke: 'ink', caret: 'ink', decoration: 'ink', accent: 'ink',
};

function roleOf(utility: string): Role | null {
  if (/^border-[trblxy]$/.test(utility)) return 'line';
  return ROLE[utility] ?? null;
}

function property(utility: string): string {
  if (/^border-[trblxy]$/.test(utility)) {
    const side = { t: 'top', r: 'right', b: 'bottom', l: 'left', x: 'inline', y: 'block' }[utility.slice(-1)]!;
    return `border-${side}-color`;
  }
  return (
    {
      bg: 'background-color', text: 'color', border: 'border-color', divide: 'border-color', ring: '--tw-ring-color',
      'ring-offset': '--tw-ring-offset-color', outline: 'outline-color', from: '--tw-gradient-from', via: '--tw-gradient-via',
      to: '--tw-gradient-to', fill: 'fill', stroke: 'stroke', caret: 'caret-color', decoration: 'text-decoration-color',
      placeholder: 'color', accent: 'accent-color',
    } as Record<string, string>
  )[utility];
}

function lightColor(p: Parsed, role: Role): string | null {
  if (p.color === 'white') {
    // White text reads on the navy shell; on a white page it becomes ink
    // (and is put back on solid buttons by the "on accent" rule below).
    if (role === 'ink') return LIGHT.ink;
    if (p.alpha === null) return null; // solid white surfaces / borders are fine as they are
    // Translucent white is a highlight on navy; on white the same job needs a tint of ink.
    return LIGHT.ink;
  }
  return role === 'surface' ? lightSurface(p.color) : role === 'line' ? lightLine(p.color) : lightInk(p.color);
}

const withAlpha = (color: string, alpha: number | null) =>
  alpha === null || alpha >= 100 ? color : `color-mix(in srgb, ${color} ${alpha}%, transparent)`;

const ROOT = 'html[data-theme="light"]';

// Solid coloured backgrounds (buttons, badges, dark overlays) keep their
// colour in the light theme, so near-white text on or inside them must stay
// near-white. Those containers set this custom property; every near-white
// text rule reads it and falls back to dark ink everywhere else.
const ON_ACCENT = '--fc-on-accent';

function isNearWhite(color: string): boolean {
  if (color === 'white') return true;
  const rgb = parseHex(color);
  return !!rgb && luminance(rgb) > 0.5 && chroma(rgb) <= 70;
}

/** The CSS rule that recolours one class for the light theme, or null when it needs none. */
export function lightRuleForToken(token: string): string | null {
  const p = parseToken(token);
  if (!p) return null;
  const role = roleOf(p.utility);
  if (!role) return null;
  const color = lightColor(p, role);
  if (!color) return null;

  // A white veil at 5–20 % barely shows on white: halve it as an ink tint instead.
  const alpha = p.color === 'white' && role !== 'ink' && p.alpha !== null ? Math.max(4, Math.round(p.alpha / 2)) : p.alpha;

  let media: string | null = null;
  let before = '';
  let after = '';
  for (const v of p.variants) {
    if (MEDIA[v]) media = MEDIA[v];
    else if (PSEUDO[v]) after += PSEUDO[v];
    else if (v === 'group-hover') before = '.group:hover ';
    else return null; // a variant this generator doesn't understand: leave the class alone
  }
  if (p.utility === 'placeholder') after += '::placeholder';
  const child = p.utility === 'divide' ? ' > *' : '';
  const selector = `${ROOT} ${before}.${escapeClass(token)}${after}${child}`;
  let value = withAlpha(color, alpha);
  let extra = '';
  if (role === 'ink' && isNearWhite(p.color)) value = `var(${ON_ACCENT}, ${value})`;
  // A recoloured panel inside a solid accent starts a normal (dark-ink) area again.
  if (p.utility === 'bg' && !p.variants.length && p.alpha === null) extra = `;${ON_ACCENT}:initial`;
  const rule = `${selector}{${property(p.utility)}:${value} !important${extra}}`;
  return media ? `@media (min-width:${media}){${rule}}` : rule;
}

/** Selectors of the solid accent containers (see ON_ACCENT). */
export function accentContainerSelectors(tokens: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const token of tokens) {
    const p = parseToken(token);
    if (!p || p.variants.length || p.alpha !== null || p.color === 'white') continue;
    if ((p.utility === 'bg' || p.utility === 'from') && isAccentSurface(p.color)) out.add(`.${escapeClass(token)}`);
  }
  for (const hue of NAMED_ACCENT_HUES) for (const shade of NAMED_ACCENT_SHADES) out.add(`.bg-${hue}-${shade}`);
  out.add('.bg-black');
  out.add('[class*="bg-black/"]');
  return [...out];
}

// --- Tailwind's named palette -------------------------------------------------
// The navy shell also uses named shades that only read on a dark page: pale
// text (text-amber-200, text-slate-300 …) and near-black translucent panels
// (bg-red-900/20, bg-slate-800/40 …).

const HUE_500: Record<string, string> = {
  red: '#EF4444', rose: '#F43F5E', pink: '#EC4899', orange: '#F97316', amber: '#F59E0B', yellow: '#EAB308', lime: '#84CC16',
  green: '#22C55E', emerald: '#10B981', teal: '#14B8A6', cyan: '#06B6D4', sky: '#0EA5E9', blue: '#3B82F6', indigo: '#6366F1',
  violet: '#8B5CF6', purple: '#A855F7', fuchsia: '#D946EF',
};
const HUE_700: Record<string, string> = {
  red: '#B91C1C', rose: '#BE123C', pink: '#BE185D', orange: '#C2410C', amber: '#B45309', yellow: '#A16207', lime: '#4D7C0F',
  green: '#15803D', emerald: '#047857', teal: '#0F766E', cyan: '#0E7490', sky: '#0369A1', blue: '#1D4ED8', indigo: '#4338CA',
  violet: '#6D28D9', purple: '#7E22CE', fuchsia: '#A21CAF',
};
const GREYS = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const ALL_HUES = [...Object.keys(HUE_500), ...GREYS].join('|');

export const NAMED_TOKEN_PATTERN = new RegExp(
  `(?:(?:hover|focus|active|group-hover):)*(?:text|bg|border(?:-[trblxy])?)-(?:${ALL_HUES})-(?:50|100|200|300|700|800|900|950)(?:\\/\\d{1,3})?!?(?![\\w/[-])`,
  'g',
);

interface NamedParsed { variants: string[]; utility: string; hue: string; shade: number; alpha: number | null }

function parseNamed(token: string): NamedParsed | null {
  const m = new RegExp(`^((?:[a-z-]+:)*)(text|bg|border(?:-[trblxy])?)-(${ALL_HUES})-(\\d{2,3})(?:\\/(\\d{1,3}))?$`).exec(token);
  if (!m) return null;
  return { variants: m[1] ? m[1].slice(0, -1).split(':') : [], utility: m[2], hue: m[3], shade: Number(m[4]), alpha: m[5] ? Number(m[5]) : null };
}

function namedLightValue(p: NamedParsed): string | null {
  const grey = GREYS.includes(p.hue);
  if (p.utility === 'text') {
    if (p.shade > 300) return null;
    const ink = grey ? (p.shade <= 200 ? LIGHT.inkSoft : LIGHT.inkMuted) : HUE_700[p.hue];
    return `var(${ON_ACCENT}, ${withAlpha(ink, p.alpha)})`;
  }
  // Only translucent dark shades are navy-page panels; solid ones are real buttons / badges.
  if (p.alpha === null || p.shade < 700) return null;
  if (p.utility === 'bg') {
    if (grey) return withAlpha(LIGHT.ink, Math.max(3, Math.round(p.alpha / 10)));
    return withAlpha(HUE_500[p.hue], p.alpha >= 60 ? 18 : 10);
  }
  return grey ? LIGHT.line : withAlpha(HUE_500[p.hue], 40);
}

function namedSelector(token: string, p: NamedParsed): { before: string; cls: string } | null {
  let before = '';
  let after = '';
  for (const v of p.variants) {
    if (PSEUDO[v]) after += PSEUDO[v];
    else if (v === 'group-hover') before = '.group:hover ';
    else return null;
  }
  return { before, cls: `.${escapeClass(token)}${after}` };
}

export function lightRuleForNamedToken(token: string): string | null {
  const p = parseNamed(token);
  if (!p) return null;
  const value = namedLightValue(p);
  const sel = namedSelector(token, p);
  if (!value || !sel) return null;
  return `${ROOT} ${sel.before}${sel.cls}{${property(p.utility)}:${value} !important}`;
}

/** The whole light-theme override sheet for the given class names. */
export function buildLightThemeCss(tokens: Iterable<string>): string {
  const unique = [...new Set(['text-white', ...tokens])].sort();
  const rules: string[] = [];
  for (const token of unique) {
    // Tailwind's important modifier (text-white!) is a class of its own: same
    // colour as the plain class, but the selector must name the "!" class.
    const bare = token.endsWith('!') ? token.slice(0, -1) : token;
    const rule = lightRuleForToken(bare) ?? lightRuleForNamedToken(bare);
    if (!rule) continue;
    // Tailwind's own "!" utility is an important declaration inside a layer,
    // which beats any unlayered rule — only an earlier layer overrides it.
    rules.push(bare === token ? rule : `@layer base{${rule.replace(`.${escapeClass(bare)}`, `.${escapeClass(token)}`)}}`);
  }
  const accents = `${ROOT} :is(${accentContainerSelectors(unique).join(',')}){${ON_ACCENT}:#FFFFFF;color:#FFFFFF}`;
  // A light panel inside a solid accent (a white dialog on its dark backdrop)
  // is a normal dark-ink area again: without this, text with no colour class
  // of its own (select values, plain buttons) inherits the accent's white.
  // In the base layer so that every text utility on the panel still wins.
  const panels = new Set(['.bg-white', '.bg-slate-50', '.bg-gray-50', '.bg-slate-100', '.bg-gray-100']);
  for (const token of unique) {
    const p = parseToken(token);
    if (p && p.utility === 'bg' && !p.variants.length && p.alpha === null && p.color !== 'white' && lightSurface(p.color)) {
      panels.add(`.${escapeClass(token)}`);
    }
  }
  const panelReset = `@layer base{${ROOT} :is(${[...panels].join(',')}){${ON_ACCENT}:initial;color:${LIGHT.ink}}}`;
  return ['/* generated by src/lib/theme/lightThemeRules.ts — do not edit */', accents, panelReset, ...rules].join('\n') + '\n';
}

/** Every themable class name found in a piece of source text. */
export function extractTokens(source: string): string[] {
  return [...(source.match(TOKEN_PATTERN) ?? []), ...(source.match(NAMED_TOKEN_PATTERN) ?? [])];
}
