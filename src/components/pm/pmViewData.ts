import type { CalendarEvent, PMOperationalStatus } from '../../types/pm.types';

/** Board columns, most urgent first. Paused PMs get a column only when there are some. */
export const BOARD_COLUMNS: PMOperationalStatus[] = ['overdue', 'due_soon', 'in_progress', 'on_track', 'completed', 'paused'];

export const STATUS_HEX: Record<PMOperationalStatus, string> = {
  on_track: '#10B981',
  due_soon: '#F59E0B',
  overdue: '#EF4444',
  paused: '#94A3B8',
  completed: '#3B82F6',
  in_progress: '#6366F1',
};

export function groupByStatus(events: CalendarEvent[]): { status: PMOperationalStatus; items: CalendarEvent[] }[] {
  const groups = new Map<PMOperationalStatus, CalendarEvent[]>();
  events.forEach((e) => {
    const s = e.operationalStatus ?? 'on_track';
    groups.set(s, [...(groups.get(s) ?? []), e]);
  });
  return BOARD_COLUMNS.filter((s) => s !== 'paused' || groups.has(s)).map((status) => ({
    status,
    items: (groups.get(status) ?? []).slice().sort((a, b) => a.date.getTime() - b.date.getTime()),
  }));
}

const DAY = 24 * 3600 * 1000;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Events that fall in [start, start + days), with their position as a fraction of that window. */
export function timelineRows(events: CalendarEvent[], start: Date, days: number) {
  const from = startOfDay(start).getTime();
  const span = days * DAY;
  return events
    .filter((e) => e.date.getTime() >= from && e.date.getTime() < from + span)
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => {
      const left = (e.date.getTime() - from) / span;
      // A PM is planned for a day: its bar covers that whole day, from its start time.
      const width = Math.min(1 - left, DAY / span);
      return { event: e, left, width };
    });
}
