import { describe, expect, it } from 'vitest';
import { companyApproval } from '../companyApproval';

describe('companyApproval', () => {
  it('keeps pending and rejected registrations locked out', () => {
    expect(companyApproval('pending')).toBe('pending');
    expect(companyApproval('rejected')).toBe('rejected');
  });
  it('treats approved and pre-approval companies (no field) as approved', () => {
    expect(companyApproval('approved')).toBe('approved');
    expect(companyApproval(undefined)).toBe('approved');
    expect(companyApproval(null)).toBe('approved');
    expect(companyApproval('something-else')).toBe('approved');
  });
});
