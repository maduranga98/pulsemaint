import { describe, it, expect } from 'vitest';
import {
  LIGHT,
  accentContainerSelectors,
  buildLightThemeCss,
  extractTokens,
  isAccentSurface,
  lightInk,
  lightLine,
  lightRuleForNamedToken,
  lightRuleForToken,
  lightSurface,
} from '../theme/lightThemeRules';

describe('colour mapping', () => {
  it('turns the navy surfaces into light ones and leaves accents alone', () => {
    expect(lightSurface('#0A1628')).toBe(LIGHT.page);
    expect(lightSurface('#0F1E35')).toBe(LIGHT.card);
    expect(lightSurface('#142849')).toBe(LIGHT.raised);
    expect(lightSurface('#1E3A5F')).toBe(LIGHT.track);
    expect(lightSurface('#1A56DB')).toBeNull();
    expect(lightSurface('#10B981')).toBeNull();
    expect(lightSurface('#FEF3C7')).toBeNull();
  });
  it('maps dark red / amber / green panels to a soft tint', () => {
    expect(lightSurface('#7F1D1D')).toBe('#FDE8E8');
    expect(lightSurface('#3A2F12')).toBe('#FEF3C7');
    expect(lightSurface('#13301F')).toBe('#DCF5E9');
  });
  it('maps navy borders to light lines', () => {
    expect(lightLine('#1E3A5F')).toBe(LIGHT.line);
    expect(lightLine('#2E5A8F')).toBe(LIGHT.lineStrong);
    expect(lightLine('#1A56DB')).toBeNull();
  });
  it('maps pale text to dark ink and keeps text that is already dark', () => {
    expect(lightInk('#F0F4F8')).toBe(LIGHT.ink);
    expect(lightInk('#B8C7DB')).toBe(LIGHT.inkSoft);
    expect(lightInk('#8BA3BF')).toBe(LIGHT.inkMuted);
    expect(lightInk('#60A5FA')).toBe('#1D4ED8');
    expect(lightInk('#0A1628')).toBeNull();
    expect(lightInk('#1A56DB')).toBeNull();
  });
  it('knows which solid backgrounds carry light text', () => {
    expect(isAccentSurface('#1A56DB')).toBe(true);
    expect(isAccentSurface('#EF4444')).toBe(true);
    expect(isAccentSurface('#0F1E35')).toBe(false); // recoloured, not an accent
    expect(isAccentSurface('#FEF3C7')).toBe(false); // too light for white text
  });
});

describe('lightRuleForToken', () => {
  it('writes a rule scoped to the light theme', () => {
    expect(lightRuleForToken('bg-[#0F1E35]')).toBe(
      'html[data-theme="light"] .bg-\\[\\#0F1E35\\]{background-color:#FFFFFF !important;--fc-on-accent:initial}',
    );
    expect(lightRuleForToken('border-[#1E3A5F]')).toContain('border-color:#DCE4F0 !important');
  });
  it('handles variants, opacity and media prefixes', () => {
    expect(lightRuleForToken('hover:bg-[#142849]')).toContain('.hover\\:bg-\\[\\#142849\\]:hover{');
    expect(lightRuleForToken('border-[#1E3A5F]/60')).toContain('color-mix(in srgb, #DCE4F0 60%, transparent)');
    expect(lightRuleForToken('sm:border-[#1E3A5F]')).toMatch(/^@media \(min-width:40rem\)\{/);
    expect(lightRuleForToken('group-hover:bg-[#1E3A5F]')).toContain('.group:hover .group-hover\\:bg-');
    expect(lightRuleForToken('placeholder:text-[#8BA3BF]')).toContain('::placeholder{');
    expect(lightRuleForToken('border-l-[#1E3A5F]')).toContain('border-left-color:');
  });
  it('lets near-white text stay white on solid accents', () => {
    expect(lightRuleForToken('text-white')).toBe('html[data-theme="light"] .text-white{color:var(--fc-on-accent, ' + LIGHT.ink + ') !important}');
    expect(lightRuleForToken('text-[#F0F4F8]')).toContain(`var(--fc-on-accent, ${LIGHT.ink})`);
    expect(lightRuleForToken('text-[#60A5FA]')).toContain('color:#1D4ED8 !important');
  });
  it('writes nothing for colours that already work on a light page', () => {
    expect(lightRuleForToken('bg-[#1A56DB]')).toBeNull();
    expect(lightRuleForToken('bg-[#1A56DB]/15')).toBeNull();
    expect(lightRuleForToken('text-[#0A1628]')).toBeNull();
    expect(lightRuleForToken('bg-white')).toBeNull();
    expect(lightRuleForToken('peer-checked:bg-[#0F1E35]')).toBeNull(); // unknown variant: left alone
  });
});

describe('named palette', () => {
  it('deepens pale text and softens near-black translucent panels', () => {
    expect(lightRuleForNamedToken('text-amber-200')).toContain('var(--fc-on-accent, #B45309)');
    expect(lightRuleForNamedToken('text-slate-300')).toContain(LIGHT.inkMuted);
    expect(lightRuleForNamedToken('bg-red-900/20')).toContain('color-mix(in srgb, #EF4444 10%, transparent)');
    expect(lightRuleForNamedToken('border-blue-800/60')).toContain('border-color:');
  });
  it('leaves normal light-page shades alone', () => {
    expect(lightRuleForNamedToken('bg-red-900')).toBeNull();
    expect(lightRuleForNamedToken('text-slate-700')).toBeNull();
  });
});

describe('extractTokens / buildLightThemeCss', () => {
  const source = `<div className="bg-[#0F1E35] border border-[#1E3A5F] text-[#F0F4F8] hover:bg-[#142849]">
    <button className="bg-[#1A56DB] text-white">Save</button><p className="text-amber-200 text-slate-500">x</p></div>`;
  it('finds the themable class names and nothing else', () => {
    expect(extractTokens(source).sort()).toEqual(
      ['bg-[#0F1E35]', 'bg-[#1A56DB]', 'border-[#1E3A5F]', 'hover:bg-[#142849]', 'text-[#F0F4F8]', 'text-amber-200', 'text-white'].sort(),
    );
    expect(extractTokens('text-slate-500 text-white-ish px-[#abc]')).toEqual([]);
  });
  it('marks solid accents so white text survives on them', () => {
    const accents = accentContainerSelectors(extractTokens(source));
    expect(accents).toContain('.bg-\\[\\#1A56DB\\]');
    expect(accents).toContain('.bg-blue-600');
    expect(accents).not.toContain('.bg-\\[\\#0F1E35\\]');
  });
  it('builds one stylesheet, every rule under the light theme only', () => {
    const css = buildLightThemeCss(extractTokens(source));
    const lines = css.trim().split('\n').slice(1);
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.every((l) => l.includes('html[data-theme="light"]'))).toBe(true);
    expect(css).toContain('--fc-on-accent:#FFFFFF');
    expect(buildLightThemeCss([])).toContain('.text-white{');
  });
});

describe("Tailwind's important modifier", () => {
  it('themes text-white! like text-white, on its own class', () => {
    expect(extractTokens('className="text-2xl text-white! text-slate-300!"')).toEqual(['text-white!', 'text-slate-300!']);
    const css = buildLightThemeCss(['text-white!', 'text-slate-300!']);
    expect(css).toContain('.text-white\\!{color:');
    expect(css).toContain('.text-slate-300\\!{color:');
  });
});
