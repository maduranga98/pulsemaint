import { describe, it, expect } from 'vitest';
import enUS from '../../locales/en-US.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import de from '../../locales/de.json';
import zh from '../../locales/zh.json';
import ja from '../../locales/ja.json';
import si from '../../locales/si.json';

// Every language offered in the switcher must carry every en-US string —
// otherwise the page silently falls back to English for that role/module.
// (Sinhala joins this list once its translation is complete.)

type Tree = { [k: string]: string | Tree };

function flatten(o: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else flatten(v, key).forEach((val, kk) => out.set(kk, val));
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

const en = flatten(enUS as Tree);
const LOCALES: Record<string, Tree> = { es, fr, de, zh, ja, si } as unknown as Record<string, Tree>;

describe.each(Object.entries(LOCALES))('locale %s', (_code, tree) => {
  const loc = flatten(tree);

  it('has every en-US key', () => {
    const missing = [...en.keys()].filter((k) => !loc.has(k));
    expect(missing).toEqual([]);
  });

  // A translation may drop a placeholder its grammar doesn't need (e.g.
  // zh/ja have no {{plural}}), but must never use one en-US doesn't pass.
  it('uses only {{placeholders}} that en-US provides', () => {
    const mismatched = [...en.entries()]
      .filter(([k, v]) => loc.has(k) && placeholders(loc.get(k)!).some((p) => !placeholders(v).includes(p)))
      .map(([k]) => k);
    expect(mismatched).toEqual([]);
  });
});
