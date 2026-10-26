import { describe, it, expect } from 'vitest';
import { LOCKED_FEATURE_ROWS } from '../planCatalog';

describe('plan comparison tables', () => {
  it('lists each locked feature once (rows are keyed by feature)', () => {
    const keys = LOCKED_FEATURE_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
