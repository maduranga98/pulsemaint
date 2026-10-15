/**
 * Pure PM scheduling rules (no Firebase) — unit-tested from the root vitest
 * suite (src/lib/__tests__/pmScheduling.test.ts).
 *
 * Dates are handled in UTC: due dates are stored as UTC midnight of the
 * picked calendar day (the PM form's date inputs), and Cloud Functions run
 * in UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** PM form defaults (src/schemas/pm.ts). */
const DEFAULT_AUTO_CLOSE_DAYS = 3;
const DEFAULT_ESCALATION_HOURS = 24;

/** Recurrences that never repeat — their work order is created with the schedule. */
const NON_RECURRING = new Set(["one_time"]);

/**
 * Date of `date` moved by `months` calendar months, keeping `anchorDay`
 * (e.g. the 31st) and clamping to the month's last day — Jan 31 → Feb 28 →
 * Mar 31, never drifting to Mar 3 or staying on the 28th.
 * @param {Date} date start
 * @param {number} months months to add
 * @param {number} anchorDay preferred day of month (1–31)
 * @return {Date} moved date
 */
function addMonthsClamped(date, months, anchorDay) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(anchorDay, lastDay),
      date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

/**
 * Next occurrence after `from` for one recurrence type.
 * @param {Date} from current occurrence
 * @param {string} recurrence recurrence type
 * @param {number|null} customDays interval for 'custom'
 * @param {number} anchorDay day of month monthly-style recurrences keep
 * @return {Date|null} next occurrence, or null when it doesn't repeat
 */
function stepRecurrence(from, recurrence, customDays, anchorDay) {
  switch (recurrence) {
    case "daily": return new Date(from.getTime() + DAY_MS);
    case "weekly": return new Date(from.getTime() + 7 * DAY_MS);
    case "biweekly": return new Date(from.getTime() + 14 * DAY_MS);
    case "monthly": return addMonthsClamped(from, 1, anchorDay);
    case "quarterly": return addMonthsClamped(from, 3, anchorDay);
    case "semi_annual": return addMonthsClamped(from, 6, anchorDay);
    case "annual": return addMonthsClamped(from, 12, anchorDay);
    case "custom": {
      const days = Number(customDays);
      return Number.isFinite(days) && days > 0 ? new Date(from.getTime() + days * DAY_MS) : null;
    }
    default: return null;
  }
}

/** Month/day key (MMDD as a number) — the peak season repeats every year. */
function monthDayKey(date) {
  return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

/**
 * Whether `date` falls inside the schedule's peak season (inclusive). The
 * season is matched by month and day so it recurs every year, and may wrap
 * the new year (e.g. Nov 15 – Feb 15).
 * @param {Date} date occurrence
 * @param {object} schedule PM schedule
 * @return {boolean} in season
 */
function inPeakSeason(date, schedule) {
  if (!schedule.seasonalOverride || !schedule.peakSeasonInterval) return false;
  const start = toDate(schedule.peakSeasonStart);
  const end = toDate(schedule.peakSeasonEnd);
  if (!start || !end) return false;
  const k = monthDayKey(date);
  const s = monthDayKey(start);
  const e = monthDayKey(end);
  return s <= e ? k >= s && k <= e : k >= s || k <= e;
}

/**
 * The occurrence after `from`, using the peak-season interval when `from`
 * lies in the peak season.
 * @param {Date} from current occurrence
 * @param {object} schedule PM schedule
 * @return {Date|null} next occurrence
 */
function nextOccurrence(from, schedule) {
  const anchor = toDate(schedule.firstDueDate) || toDate(schedule.nextDueDate) || from;
  const anchorDay = anchor.getUTCDate();
  const recurrence = inPeakSeason(from, schedule) ? schedule.peakSeasonInterval : schedule.recurrenceType;
  return stepRecurrence(from, recurrence, schedule.customIntervalDays, anchorDay);
}

/**
 * Accepts a Firestore Timestamp, Date, millis or ISO string.
 * @param {*} value date-ish value
 * @return {Date|null} date
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lead time in whole days (form default 1; negative/invalid → 0). */
function leadDays(schedule) {
  const n = Number(schedule.leadTimeDays);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * What the daily run should do for one calendar schedule.
 *
 * A work order is raised `leadTimeDays` before the occurrence is due. If the
 * schedule has fallen behind by more than one occurrence (the scheduler was
 * down, or the schedule was created with a first due date long past), only
 * the latest occurrence that is due gets a work order — the older ones are
 * counted in `skipped` instead of flooding the floor with stale work orders.
 *
 * @param {object} schedule PM schedule data
 * @param {Date} now current time
 * @return {{action: 'none'|'generate'|'end', dueDate?: Date, nextDueDate?: Date|null, skipped?: number}}
 *   nextDueDate null = the recurrence can't step (e.g. custom with no
 *   interval): the schedule is completed after this work order.
 */
function planCalendarRun(schedule, now) {
  if (schedule.status !== "active" || schedule.triggerType !== "calendar") return {action: "none"};
  if (NON_RECURRING.has(schedule.recurrenceType)) return {action: "none"};
  let due = toDate(schedule.nextDueDate);
  if (!due) return {action: "none"};
  const end = toDate(schedule.endDate);
  const lead = leadDays(schedule) * DAY_MS;

  if (end && due.getTime() > end.getTime()) return {action: "end"};
  if (due.getTime() - lead > now.getTime()) return {action: "none"};

  // Catch up: move to the latest occurrence that is already due.
  let skipped = 0;
  for (let i = 0; i < 1000; i++) {
    const next = nextOccurrence(due, schedule);
    if (!next || next.getTime() <= due.getTime()) break;
    if (next.getTime() > now.getTime()) break;
    if (end && next.getTime() > end.getTime()) break;
    due = next;
    skipped += 1;
  }
  // The occurrence after this one. Past the end date it is still stored —
  // the next run then sees it is beyond the end and completes the schedule.
  const nextDueDate = nextOccurrence(due, schedule);
  return {action: "generate", dueDate: due, nextDueDate, skipped};
}

/**
 * Usage-based schedules: the meter reading the next work order is measured
 * from. `usageBaselineValue` is the reading when the last work order was
 * raised; a reading lower than it means the meter was reset since, so it
 * counts from zero.
 * @param {object} schedule PM schedule data
 * @return {{due: boolean, sinceLast: number}} whether a work order is due
 */
function usageState(schedule) {
  const threshold = Number(schedule.triggerAfterValue);
  const current = Number(schedule.currentMeterValue);
  if (!Number.isFinite(threshold) || threshold <= 0 || !Number.isFinite(current)) {
    return {due: false, sinceLast: 0};
  }
  const baseline = Number(schedule.usageBaselineValue);
  const sinceLast = Number.isFinite(baseline) && current >= baseline ? current - baseline : current;
  return {due: sinceLast >= threshold, sinceLast};
}

/**
 * PM compliance counters → rate. Every occurrence lands in exactly one
 * bucket (on time, late, missed); open ones aren't counted yet.
 * @param {{completedOnTime?: number, completedLate?: number, missed?: number}} c counters
 * @return {number} compliance rate 0–100 (100 when nothing has fallen due)
 */
function complianceRate(c) {
  const onTime = Math.max(0, Number(c.completedOnTime) || 0);
  const late = Math.max(0, Number(c.completedLate) || 0);
  const missed = Math.max(0, Number(c.missed) || 0);
  const total = onTime + late + missed;
  return total > 0 ? Math.round((onTime / total) * 100) : 100;
}

/**
 * Status of a PM occurrence that is still open, given escalation and
 * auto-close settings copied onto its pm_history record.
 * @param {object} history pm_history data
 * @param {Date} now current time
 * @return {'in_progress'|'overdue'|'missed'} status it should have now
 */
function openOccurrenceStatus(history, now) {
  const due = toDate(history.dueDate);
  if (!due) return history.status === "overdue" ? "overdue" : "in_progress";
  // The PM form's default auto-close is 3 days (schemas/pm.ts); records
  // written before the setting was copied onto them use the same default.
  const rawClose = Number(history.autoCloseAfterDays);
  const closeDays = Number.isFinite(rawClose) && rawClose > 0 ? rawClose : DEFAULT_AUTO_CLOSE_DAYS;
  if (now.getTime() > due.getTime() + closeDays * DAY_MS) return "missed";
  const hours = Number(history.overdueEscalationHours);
  const escalation = (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ESCALATION_HOURS) * 60 * 60 * 1000;
  return now.getTime() > due.getTime() + escalation ? "overdue" : "in_progress";
}

module.exports = {
  DAY_MS,
  DEFAULT_AUTO_CLOSE_DAYS,
  DEFAULT_ESCALATION_HOURS,
  NON_RECURRING,
  addMonthsClamped,
  stepRecurrence,
  inPeakSeason,
  nextOccurrence,
  toDate,
  planCalendarRun,
  usageState,
  complianceRate,
  openOccurrenceStatus,
};
