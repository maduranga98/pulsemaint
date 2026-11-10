import { describe, it, expect } from 'vitest';
import { groupByStatus, timelineRows } from '../../components/pm/pmViewData';
import type { CalendarEvent } from '../../types/pm.types';

const ev = (id: string, date: Date, status?: CalendarEvent['operationalStatus']): CalendarEvent => ({
  id, scheduleId: id, title: id, date, priority: 'medium', machineName: 'M', technicianNames: [], pmType: 'time_based', status: 'active', operationalStatus: status,
}) as unknown as CalendarEvent;

describe('groupByStatus', () => {
  it('orders columns by urgency, sorts cards by date and hides the paused column when empty', () => {
    const cols = groupByStatus([ev('b', new Date(2026, 10, 12), 'on_track'), ev('a', new Date(2026, 10, 3), 'overdue'), ev('c', new Date(2026, 10, 9), 'overdue')]);
    expect(cols.map((c) => c.status)).toEqual(['overdue', 'due_soon', 'in_progress', 'on_track', 'completed']);
    expect(cols[0].items.map((e) => e.id)).toEqual(['a', 'c']);
  });
  it('adds a paused column only when something is paused; unknown status counts as on track', () => {
    const cols = groupByStatus([ev('p', new Date(2026, 10, 3), 'paused'), ev('x', new Date(2026, 10, 4))]);
    expect(cols.at(-1)?.status).toBe('paused');
    expect(cols.find((c) => c.status === 'on_track')?.items.map((e) => e.id)).toEqual(['x']);
  });
});

describe('timelineRows', () => {
  const start = new Date(2026, 10, 8);
  it('keeps events inside the window with their position and one-day width', () => {
    const rows = timelineRows([ev('in', new Date(2026, 10, 10, 12)), ev('before', new Date(2026, 10, 7)), ev('after', new Date(2026, 10, 22))], start, 14);
    expect(rows.map((r) => r.event.id)).toEqual(['in']);
    expect(rows[0].left).toBeCloseTo(2.5 / 14, 5);
    expect(rows[0].width).toBeCloseTo(1 / 14, 5);
  });
  it('clips the bar at the end of the window', () => {
    const [row] = timelineRows([ev('edge', new Date(2026, 10, 21, 18))], start, 14);
    expect(row.left + row.width).toBeCloseTo(1, 5);
  });
});
