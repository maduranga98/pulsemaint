import { getEffectivePMHistoryStatus } from '../utils/pm.utils';

export interface PmMonthCompliance {
  /** PMs of the month that have fallen due (done, missed or overdue). */
  due: number;
  /** Of those, the ones completed on time. */
  onTime: number;
  /** onTime / due as a whole percentage; null when nothing has fallen due yet. */
  percent: number | null;
}

/** Month key used on pm_history records, e.g. "2026-11". */
export function pmMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/**
 * PM compliance for one calendar month, from pm_history records — the same
 * definition as the compliance dashboard (on time ÷ scheduled), except that a
 * PM still open and not yet past its due date is left out instead of counted
 * against the month. An open PM past its due date counts as overdue.
 */
export function pmMonthCompliance(
  history: { status?: string | null; dueDate?: unknown; completedDate?: unknown; month?: string | null }[],
  monthKey: string,
  now: Date = new Date(),
): PmMonthCompliance {
  let due = 0;
  let onTime = 0;
  for (const record of history) {
    if (record.month !== monthKey) continue;
    const status = getEffectivePMHistoryStatus(record, now);
    if (status === 'completed_on_time') {
      due++;
      onTime++;
    } else if (status === 'completed_late' || status === 'missed' || status === 'overdue') {
      due++;
    }
  }
  return { due, onTime, percent: due ? Math.round((onTime / due) * 100) : null };
}
