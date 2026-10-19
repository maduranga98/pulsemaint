import { describe, it, expect } from 'vitest';
import { emptyLead, findLeadForTrialRequest, trialRequestToLeadInput, type Lead, type TrialRequestLike } from '../platform/leads';

const lead = (over: Partial<Lead>): Lead => ({
  ...emptyLead(), id: 'l1', archived: false, createdAt: null, updatedAt: null, lastActivityAt: null, createdByEmail: null, closedAt: null, ...over,
} as Lead);

const req: TrialRequestLike = { id: 'c1', name: 'Dynaro Engineering (Pvt) Ltd', adminName: 'Praveen', adminEmail: 'Praveen@Dynaro.lk', country: 'LK', industry: 'Manufacturing' };

describe('findLeadForTrialRequest', () => {
  it('prefers the lead already linked to the company', () => {
    const linked = lead({ id: 'a', companyId: 'c1', businessName: 'Something else' });
    const byMail = lead({ id: 'b', email: 'praveen@dynaro.lk' });
    expect(findLeadForTrialRequest(req, [byMail, linked])?.id).toBe('a');
  });
  it('then matches the admin e-mail, ignoring case', () => {
    const byMail = lead({ id: 'b', email: ' praveen@dynaro.LK ' });
    const byName = lead({ id: 'n', businessName: 'Dynaro Engineering Pvt Ltd' });
    expect(findLeadForTrialRequest(req, [byName, byMail])?.id).toBe('b');
  });
  it('then matches the business name ignoring punctuation and case', () => {
    expect(findLeadForTrialRequest(req, [lead({ id: 'n', businessName: 'DYNARO engineering pvt ltd' })])?.id).toBe('n');
  });
  it('prefers an active lead over an archived one and returns null when nothing matches', () => {
    const old = lead({ id: 'old', email: 'praveen@dynaro.lk', archived: true });
    const live = lead({ id: 'live', email: 'praveen@dynaro.lk' });
    expect(findLeadForTrialRequest(req, [old, live])?.id).toBe('live');
    expect(findLeadForTrialRequest(req, [lead({ businessName: 'Other Co', email: 'x@y.z' })])).toBeNull();
  });
});

describe('trialRequestToLeadInput', () => {
  it('builds a new lead linked to the company', () => {
    const l = trialRequestToLeadInput(req);
    expect(l).toMatchObject({ businessName: req.name, contactPerson: 'Praveen', email: 'Praveen@Dynaro.lk', source: 'Trial request', status: 'new', companyId: 'c1', district: 'LK' });
  });
});
