import { describe, expect, it } from 'vitest';
import {
  aggregateContractorJobStats,
  type ContractorJobStatRow,
} from '@/lib/contractors/contractorJobStats';

/** Stand-in for a Firestore Timestamp — the aggregator only needs toMillis. */
function ts(iso: string) {
  const ms = new Date(iso).getTime();
  return { toMillis: () => ms, iso };
}

describe('aggregateContractorJobStats', () => {
  it('returns nothing for no rows', () => {
    expect(aggregateContractorJobStats([])).toEqual({});
  });

  it('counts jobs per contractor', () => {
    const rows: ContractorJobStatRow<ReturnType<typeof ts>>[] = [
      { contractorId: 'a', at: ts('2026-01-01'), rating: null },
      { contractorId: 'a', at: ts('2026-02-01'), rating: null },
      { contractorId: 'b', at: ts('2026-01-15'), rating: null },
    ];
    const stats = aggregateContractorJobStats(rows);
    expect(stats.a.jobCount).toBe(2);
    expect(stats.b.jobCount).toBe(1);
  });

  it('keeps the most recent job date regardless of row order', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: 'a', at: ts('2026-03-10'), rating: null },
      { contractorId: 'a', at: ts('2026-01-04'), rating: null },
      { contractorId: 'a', at: ts('2026-02-20'), rating: null },
    ]);
    expect(stats.a.lastJobAt?.iso).toBe('2026-03-10');
  });

  it('falls back to a dated row when another has no date', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: 'a', at: null, rating: null },
      { contractorId: 'a', at: ts('2026-05-01'), rating: null },
    ]);
    expect(stats.a.jobCount).toBe(2);
    expect(stats.a.lastJobAt?.iso).toBe('2026-05-01');
  });

  it('leaves lastJobAt null when no row carries a date', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: 'a', at: null, rating: null },
    ]);
    expect(stats.a.lastJobAt).toBeNull();
  });

  it('averages only the rows that carry a rating', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: 'a', at: ts('2026-01-01'), rating: 4 },
      { contractorId: 'a', at: ts('2026-01-02'), rating: 5 },
      { contractorId: 'a', at: ts('2026-01-03'), rating: null },
    ]);
    expect(stats.a.jobCount).toBe(3);
    expect(stats.a.ratingCount).toBe(2);
    expect(stats.a.avgRating).toBe(4.5);
  });

  it('reports a zero average when nothing was rated', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: 'a', at: ts('2026-01-01'), rating: null },
    ]);
    expect(stats.a.ratingCount).toBe(0);
    expect(stats.a.avgRating).toBe(0);
  });

  it('counts a zero rating rather than treating it as missing', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: 'a', at: ts('2026-01-01'), rating: 0 },
      { contractorId: 'a', at: ts('2026-01-02'), rating: 4 },
    ]);
    expect(stats.a.ratingCount).toBe(2);
    expect(stats.a.avgRating).toBe(2);
  });

  it('skips rows with no contractor id', () => {
    const stats = aggregateContractorJobStats([
      { contractorId: '', at: ts('2026-01-01'), rating: 5 },
      { contractorId: 'a', at: ts('2026-01-01'), rating: 5 },
    ]);
    expect(Object.keys(stats)).toEqual(['a']);
  });

  it('merges work order and contractorJob rows for the same contractor', () => {
    // The hook concatenates both sources before calling in.
    const workOrders = [{ contractorId: 'a', at: ts('2026-04-01'), rating: 3 }];
    const contractorJobs = [{ contractorId: 'a', at: ts('2026-06-01'), rating: 5 }];
    const stats = aggregateContractorJobStats([...workOrders, ...contractorJobs]);
    expect(stats.a.jobCount).toBe(2);
    expect(stats.a.lastJobAt?.iso).toBe('2026-06-01');
    expect(stats.a.avgRating).toBe(4);
  });
});
