import { describe, expect, it } from 'vitest';
import { safeExternalUrl, safeInternalPath } from '../safeUrl';

describe('safeInternalPath', () => {
  it('accepts in-app paths with query strings', () => {
    expect(safeInternalPath('/app/work-orders?woId=abc')).toBe('/app/work-orders?woId=abc');
    expect(safeInternalPath('  /app/breakdowns ')).toBe('/app/breakdowns');
  });
  it('rejects anything that could leave the app or run script', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'https://evil.example', '//evil.example', '/\\evil.example', 'app/x', '', '/app/\nx', null, undefined, 5]) {
      expect(safeInternalPath(bad)).toBeNull();
    }
  });
});

describe('safeExternalUrl', () => {
  it('accepts http(s) only', () => {
    expect(safeExternalUrl('https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media')).toContain('https://firebasestorage.googleapis.com');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>1</script>')).toBeNull();
    expect(safeExternalUrl('not a url')).toBeNull();
  });
});
