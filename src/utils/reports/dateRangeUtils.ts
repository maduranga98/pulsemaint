import type { QuickDateRange } from '../../types/reports.types';

const pad = (value: number) => String(value).padStart(2, '0');

export function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function resolveQuickDateRange(range: QuickDateRange, base = new Date()): { from: string; to: string } {
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const from = new Date(today);
  const to = new Date(today);

  switch (range) {
    case 'today':
      break;
    case 'yesterday':
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;
    case 'this_week':
      return { from: formatDateInput(startOfWeek(today)), to: formatDateInput(today) };
    case 'last_week': {
      const start = startOfWeek(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: formatDateInput(start), to: formatDateInput(end) };
    }
    case 'this_month':
      from.setDate(1);
      break;
    case 'last_month':
      from.setMonth(from.getMonth() - 1, 1);
      return { from: formatDateInput(from), to: formatDateInput(endOfMonth(from)) };
    case 'last_3_months':
      from.setMonth(from.getMonth() - 3);
      break;
    case 'last_6_months':
      from.setMonth(from.getMonth() - 6);
      break;
    case 'this_year':
      from.setMonth(0, 1);
      break;
    case 'custom':
      break;
  }

  return { from: formatDateInput(from), to: formatDateInput(to) };
}

export function dateRangeLabel(from: string, to: string): string {
  return `${from}_to_${to}`;
}
