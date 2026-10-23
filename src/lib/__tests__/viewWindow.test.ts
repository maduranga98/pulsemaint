import { describe, it, expect } from 'vitest';
import { hasViewWindow, isBeyondViewWindow, VIEW_WINDOW_DAYS } from '../viewWindow';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23);
const ts = (daysAgo: number) => ({ toMillis: () => NOW - daysAgo * DAY });

describe('90-day view window', () => {
  it('applies to store keeper, safety officer, HR officer and supervisor only', () => {
    for (const r of ['store_keeper', 'safety_officer', 'hr_officer', 'supervisor']) expect(hasViewWindow(r)).toBe(true);
    for (const r of ['admin', 'plant_manager', 'technician', 'trainee', 'floor_operator', undefined]) expect(hasViewWindow(r)).toBe(false);
  });
  it('hides a record finished more than 90 days ago', () => {
    expect(isBeyondViewWindow('safety_officer', true, ts(VIEW_WINDOW_DAYS + 1), NOW)).toBe(true);
  });
  it('shows one finished within 90 days', () => {
    expect(isBeyondViewWindow('safety_officer', true, ts(VIEW_WINDOW_DAYS - 1), NOW)).toBe(false);
  });
  it('never hides open records or ones without a finish date', () => {
    expect(isBeyondViewWindow('supervisor', false, ts(500), NOW)).toBe(false);
    expect(isBeyondViewWindow('supervisor', true, null, NOW)).toBe(false);
  });
  it('never hides anything from admin or plant manager', () => {
    expect(isBeyondViewWindow('admin', true, ts(300), NOW)).toBe(false);
    expect(isBeyondViewWindow('plant_manager', true, ts(300), NOW)).toBe(false);
  });
  it('reads {seconds} timestamps too', () => {
    expect(isBeyondViewWindow('hr_officer', true, { seconds: (NOW - 120 * DAY) / 1000 }, NOW)).toBe(true);
  });
});
