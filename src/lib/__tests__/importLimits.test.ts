import { describe, it, expect } from 'vitest';
import { checkImportAllowed, MAX_IMPORT_ROWS, MAX_IMPORT_FILE_BYTES } from '../planLimits';

describe('checkImportAllowed', () => {
  it('allows an import that fits within the plan limit', () => {
    expect(checkImportAllowed({ newRecords: 5, existingCount: 5, limit: 10 })).toEqual({ ok: true, remaining: 5 });
  });

  it('blocks the whole import when it would exceed the plan limit', () => {
    const r = checkImportAllowed({ newRecords: 6, existingCount: 5, limit: 10 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('plan_limit');
    expect(r.remaining).toBe(5);
  });

  it('never reports negative remaining when already over the limit', () => {
    expect(checkImportAllowed({ newRecords: 1, existingCount: 12, limit: 10 }).remaining).toBe(0);
  });

  it('does not apply a plan limit on unlimited plans', () => {
    expect(checkImportAllowed({ newRecords: 400, existingCount: 99999, limit: null }).ok).toBe(true);
  });

  it('caps rows per file even on unlimited plans', () => {
    const r = checkImportAllowed({ newRecords: 1, totalRows: MAX_IMPORT_ROWS + 1, existingCount: 0, limit: null });
    expect(r.reason).toBe('too_many_rows');
  });

  it('caps file size', () => {
    const r = checkImportAllowed({ newRecords: 1, existingCount: 0, limit: null, fileBytes: MAX_IMPORT_FILE_BYTES + 1 });
    expect(r.reason).toBe('file_too_large');
  });
});
