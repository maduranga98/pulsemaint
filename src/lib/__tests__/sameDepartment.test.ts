import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));

import { sameDepartment } from '../../hooks/useRecordPlantMatcher';

describe('sameDepartment', () => {
  it('ignores case and surrounding / repeated spaces', () => {
    expect(sameDepartment('Assembly Line', ' assembly  line ')).toBe(true);
  });

  it('treats different departments as different', () => {
    expect(sameDepartment('Assembly', 'Paint Shop')).toBe(false);
  });

  it('never matches a missing department', () => {
    expect(sameDepartment(null, 'Assembly')).toBe(false);
    expect(sameDepartment('', '')).toBe(false);
  });
});
