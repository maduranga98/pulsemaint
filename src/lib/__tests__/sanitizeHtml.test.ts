import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml';

// The unit-test environment is plain Node (no DOM), where DOMPurify reports
// itself unsupported. In that case the sanitiser must fall back to showing the
// text, never the markup — so none of these payloads can ever become live HTML.
describe('sanitizeHtml without a DOM', () => {
  it.each([
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">x</a>',
  ])('never returns markup for %s', (payload) => {
    const out = sanitizeHtml(payload);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('keeps the text readable', () => {
    expect(sanitizeHtml('<p>Hello & welcome</p>')).toBe('&lt;p&gt;Hello &amp; welcome&lt;/p&gt;');
  });
});
