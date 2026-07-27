/**
 * Pure duration-calculation helpers for the Trainee Programme feature.
 *
 * A programme's placement length can be a fixed preset (6 or 12 months) or a
 * custom start/end date range picked by the admin — trainees arrive for
 * varying internship periods, so the "6 or 12 months" presets are a
 * convenience, not the only option.
 */

export type DurationPreset = 6 | 12 | 'custom';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Resolves the expected end date for a programme.
 * - For preset durations (6/12), adds that many calendar months to the start date.
 * - For 'custom', the caller-supplied end date is used as-is (validated separately).
 */
export function computeExpectedEndDate(
  preset: DurationPreset,
  startDate: Date,
  customEndDate?: Date | null,
): Date {
  if (preset === 'custom') {
    if (!customEndDate) {
      throw new Error('customEndDate is required when preset is "custom"');
    }
    return customEndDate;
  }
  return addMonths(startDate, preset);
}

/**
 * Approximate whole-month span between two dates, rounded to the nearest
 * month (minimum 1). Used to display/record a human-friendly duration for
 * custom date-range programmes (e.g. on the certificate).
 */
export function computeDurationInMonths(startDate: Date, endDate: Date): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  const diffDays = diffMs / 86400000;
  return Math.max(1, Math.round(diffDays / 30.44));
}

/** True when the end date is strictly after the start date. */
export function isValidDurationRange(startDate: Date, endDate: Date): boolean {
  return endDate.getTime() > startDate.getTime();
}

/** Human-readable label for a programme's duration, e.g. "6 months" / "10 months (custom)". */
export function formatDurationLabel(preset: DurationPreset, actualMonths: number): string {
  if (preset === 'custom') {
    return `${actualMonths} month${actualMonths === 1 ? '' : 's'} (custom)`;
  }
  return `${preset} months`;
}
