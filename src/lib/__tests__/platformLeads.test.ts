import { describe, expect, it } from 'vitest';
import {
  commissionFor, funnel, groupStats, staleLeads,
  dayReport, emptyLead, leadStats, leadsToCsv, mapImportHeaders, matchesSearch, parseImportRows, phoneKey, scheduledCalls,
  startOfDay, statusAfterCall, statusSideEffects, whatsappNumber, type Lead, type LeadActivity,
} from '../platform/leads';

const NOW = new Date(2026, 9, 9, 12, 0).getTime();

function lead(over: Partial<Lead> = {}): Lead {
  return {
    ...emptyLead(NOW), id: Math.random().toString(36).slice(2), businessName: 'Silva Auto', phone: '0771234567',
    archived: false, createdAt: null, updatedAt: null, lastActivityAt: null, createdByEmail: null, closedAt: null, ...over,
  };
}

function act(over: Partial<LeadActivity>): LeadActivity {
  return {
    id: 'a', leadId: 'l1', leadName: 'X', type: 'call', outcome: 'spoke', callNumber: 1, body: '', statusFrom: null, statusTo: null,
    nextCallAt: null, at: NOW, authorEmail: null, ...over,
  };
}

describe('statusAfterCall', () => {
  it('moves early-stage leads along by outcome', () => {
    expect(statusAfterCall('new', 'spoke', false)).toBe('called');
    expect(statusAfterCall('new', 'no_answer', false)).toBe('not_answered');
    expect(statusAfterCall('new', 'no_answer', true)).toBe('follow_up');
    expect(statusAfterCall('called', 'spoke', true)).toBe('follow_up');
    expect(statusAfterCall('new', 'call_back', false)).toBe('follow_up');
    expect(statusAfterCall('new', 'wrong_number', false)).toBe('closed_lost');
  });
  it('never drags a lead back from demo or closed', () => {
    expect(statusAfterCall('demo_booked', 'no_answer', false)).toBe('demo_booked');
    expect(statusAfterCall('closed_won', 'spoke', true)).toBe('closed_won');
  });
});

describe('statusSideEffects', () => {
  it('stamps and clears the close date', () => {
    expect(statusSideEffects('negotiation', 'closed_won', NOW)).toEqual({ closedAt: NOW });
    expect(statusSideEffects('closed_won', 'follow_up', NOW)).toEqual({ closedAt: null });
    expect(statusSideEffects('new', 'called', NOW)).toEqual({});
  });
});

describe('leadStats', () => {
  it('counts open, demos, due follow-ups and revenue per currency, ignoring archived', () => {
    const s = leadStats([
      lead({ status: 'new', nextCallAt: NOW - 1000 }),
      lead({ status: 'follow_up', nextCallAt: NOW + 86_400_000 * 3 }),
      lead({ status: 'demo_booked', demoAt: NOW + 3600_000 }),
      lead({ status: 'closed_won', closedAmount: 8000, currency: 'LKR' }),
      lead({ status: 'closed_won', closedAmount: 50, currency: 'USD' }),
      lead({ status: 'new', archived: true, nextCallAt: NOW }),
    ], NOW);
    expect(s).toEqual({ open: 3, demos: 1, demosToday: 1, followUpsDue: 1, won: 2, revenue: { LKR: 8000, USD: 50 } });
  });
});

describe('scheduledCalls', () => {
  it('buckets open leads into overdue / today / upcoming, soonest first', () => {
    const a = lead({ nextCallAt: NOW - 5000 });
    const b = lead({ nextCallAt: NOW - 86_400_000 });
    const c = lead({ nextCallAt: NOW + 3600_000 });
    const d = lead({ nextCallAt: NOW + 86_400_000 * 2 });
    const won = lead({ nextCallAt: NOW - 1, status: 'closed_won' });
    const r = scheduledCalls([a, b, c, d, won, lead()], NOW);
    expect(r.overdue.map((l) => l.id)).toEqual([b.id, a.id]);
    expect(r.today.map((l) => l.id)).toEqual([c.id]);
    expect(r.upcoming.map((l) => l.id)).toEqual([d.id]);
  });
});

describe('search and phone helpers', () => {
  it('matches names and phone digits regardless of formatting', () => {
    const l = lead({ businessName: 'Galnewa TVS', phone: '077 123 4567', location: 'Kalawewa' });
    expect(matchesSearch(l, 'galnewa')).toBe(true);
    expect(matchesSearch(l, 'kalaw')).toBe(true);
    expect(matchesSearch(l, '0771234')).toBe(true);
    expect(matchesSearch(l, 'matara')).toBe(false);
  });
  it('builds wa.me numbers and duplicate keys for Sri Lankan numbers', () => {
    expect(whatsappNumber('077 123 4567')).toBe('94771234567');
    expect(whatsappNumber('+94 77 123 4567')).toBe('94771234567');
    expect(phoneKey('0771234567')).toBe(phoneKey('+94771234567'));
  });
});

describe('dayReport', () => {
  it('summarises one day of activity', () => {
    const leads = [lead({ id: 'l1', status: 'closed_won', closedAt: NOW, closedAmount: 8000, leadDate: NOW - 86_400_000 * 10 }), lead({ id: 'l2', createdAt: NOW })];
    const r = dayReport(NOW, [
      act({ leadId: 'l1', outcome: 'spoke' }),
      act({ leadId: 'l1', outcome: 'no_answer', at: NOW - 3600_000 }),
      act({ leadId: 'l2', type: 'note', outcome: null }),
      act({ leadId: 'l2', type: 'demo', outcome: null }),
      act({ leadId: 'l2', at: NOW - 86_400_000 }),
    ], leads);
    expect(r.calls).toBe(2);
    expect(r.notes).toBe(1);
    expect(r.customers).toBe(2);
    expect(r.demosBooked).toBe(1);
    expect(r.newLeads).toBe(1);
    expect(r.won).toBe(1);
    expect(r.wonAmount).toEqual({ LKR: 8000 });
    expect(r.outcomes).toEqual({ 'Spoke to them': 1, 'No answer': 1, Note: 1 });
    expect(r.rows[0].outcome).toBe('no_answer');
  });
});

describe('import', () => {
  it('maps common headers, preferring exact matches', () => {
    const m = mapImportHeaders(['Full Name', 'Business Name', 'phone_number', 'City', 'Campaign Name', 'random']);
    expect(m).toEqual({ 0: 'contactPerson', 1: 'businessName', 2: 'phone', 3: 'location', 4: 'campaign' });
  });
  it('parses rows, falls back to contact name and skips rows without contact details', () => {
    const r = parseImportRows([
      ['full_name', 'phone_number', 'city', 'created_time'],
      ['Nimal Silva', 'p:+94771234567', 'Nugegoda', '2026-10-01'],
      ['No Phone', '', 'Galle', ''],
      [],
    ], { source: 'Facebook ad', now: NOW });
    expect(r.skipped).toBe(1);
    expect(r.leads).toHaveLength(1);
    expect(r.leads[0]).toMatchObject({
      businessName: 'Nimal Silva', contactPerson: 'Nimal Silva', phone: '+94771234567', location: 'Nugegoda', source: 'Facebook ad', status: 'new',
    });
    expect(r.leads[0].leadDate).toBe(startOfDay(Date.parse('2026-10-01')));
  });
});

describe('leadsToCsv', () => {
  it('quotes cells with commas and quotes', () => {
    const csv = leadsToCsv([lead({ businessName: 'A, "B"', notes: 'line1\nline2' })]);
    expect(csv.split('\r\n')[1]).toContain('"A, ""B"""');
    expect(csv).toContain('"line1\nline2"');
  });
});

describe('team & insights', () => {
  it('groups by source with win rate and conversion', () => {
    const g = groupStats([
      lead({ source: 'Facebook ad', status: 'closed_won', closedAmount: 1000 }),
      lead({ source: 'Facebook ad', status: 'closed_lost' }),
      lead({ source: 'Facebook ad', status: 'new' }),
      lead({ source: 'Referral', status: 'demo_booked' }),
      lead({ source: 'Referral', archived: true }),
    ], (l) => l.source);
    expect(g[0]).toMatchObject({ key: 'Facebook ad', leads: 3, open: 1, won: 1, lost: 1, winRate: 0.5, revenue: { LKR: 1000 } });
    expect(g[0].conversion).toBeCloseTo(1 / 3);
    expect(g[1]).toMatchObject({ key: 'Referral', leads: 1, demos: 1, winRate: null });
  });
  it('pays commission only on won leads the member brought in', () => {
    const c = commissionFor({ id: 'm1', commissionPct: 10 }, [
      lead({ marketerId: 'm1', status: 'closed_won', closedAmount: 8000 }),
      lead({ marketerId: 'm1', status: 'follow_up', closedAmount: 5000 }),
      lead({ marketerId: 'm2', status: 'closed_won', closedAmount: 9000 }),
    ]);
    expect(c).toEqual({ LKR: 800 });
  });
  it('finds open leads going cold', () => {
    const cold = lead({ lastActivityAt: NOW - 10 * 86_400_000 });
    const booked = lead({ lastActivityAt: NOW - 10 * 86_400_000, nextCallAt: NOW + 1 });
    const fresh = lead({ lastActivityAt: NOW - 86_400_000 });
    expect(staleLeads([cold, booked, fresh], 7, NOW).map((l) => l.id)).toEqual([cold.id]);
  });
  it('builds a monotone funnel', () => {
    const f = funnel([lead(), lead({ status: 'called', callsMade: 1 }), lead({ status: 'demo_done' }), lead({ status: 'closed_won' })]);
    expect(f.map((s) => s.count)).toEqual([4, 3, 3, 2, 2, 1]);
  });
});
