import type { HeatmapCell } from '../types/analytics.types';

export function buildHeatmapGrid(
  data: Array<{ day: number; hour: number; count: number }>,
): HeatmapCell[] {
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const entry = data.find((d) => d.day === day && d.hour === hour);
      const count = entry?.count ?? 0;
      cells.push({
        day,
        hour,
        count,
        intensity: count / maxCount,
      });
    }
  }
  return cells;
}

export function dayLabel(day: number): string {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels[day] ?? '';
}

export function hourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}
