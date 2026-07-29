/** A timestamp as it comes back from Firestore — only `toMillis` is needed here. */
export interface JobStatTimestamp {
  toMillis: () => number;
}

export interface ContractorJobStatRow<T extends JobStatTimestamp = JobStatTimestamp> {
  contractorId: string;
  /** When the job last moved — sign-off, else completion, else creation. */
  at: T | null;
  /** Overall rating for the job, when one was recorded. */
  rating: number | null;
}

export interface ContractorJobStats<T extends JobStatTimestamp = JobStatTimestamp> {
  /** Jobs on record for this contractor, across every source. */
  jobCount: number;
  /** Most recent job activity. */
  lastJobAt: T | null;
  /** Mean of every rating recorded for this contractor. */
  avgRating: number;
  ratingCount: number;
}

function millis(ts: JobStatTimestamp | null | undefined): number {
  return ts?.toMillis?.() ?? 0;
}

function laterOf<T extends JobStatTimestamp>(a: T | null, b: T | null | undefined): T | null {
  if (!b) return a;
  if (!a) return b;
  return millis(b) > millis(a) ? b : a;
}

/**
 * Rolls per-job rows up into the figures the contractor registry shows:
 * job count, most recent job, and mean rating.
 *
 * Kept free of Firebase imports so it can be unit tested on its own; the
 * hook (`useContractorJobStats`) supplies the rows from live snapshots.
 */
export function aggregateContractorJobStats<T extends JobStatTimestamp>(
  rows: ContractorJobStatRow<T>[],
): Record<string, ContractorJobStats<T>> {
  const acc: Record<string, ContractorJobStats<T> & { ratingTotal: number }> = {};

  for (const row of rows) {
    if (!row.contractorId) continue;
    const entry = acc[row.contractorId] ?? {
      jobCount: 0,
      lastJobAt: null,
      avgRating: 0,
      ratingCount: 0,
      ratingTotal: 0,
    };
    entry.jobCount += 1;
    entry.lastJobAt = laterOf(entry.lastJobAt, row.at);
    if (row.rating != null) {
      entry.ratingCount += 1;
      entry.ratingTotal += row.rating;
    }
    acc[row.contractorId] = entry;
  }

  const out: Record<string, ContractorJobStats<T>> = {};
  for (const [id, entry] of Object.entries(acc)) {
    out[id] = {
      jobCount: entry.jobCount,
      lastJobAt: entry.lastJobAt,
      ratingCount: entry.ratingCount,
      avgRating: entry.ratingCount > 0 ? entry.ratingTotal / entry.ratingCount : 0,
    };
  }
  return out;
}
