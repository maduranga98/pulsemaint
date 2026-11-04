// Department display board — shared types and pure helpers.
//
// The board (/display/:token, DepartmentDisplayPage) is a read-only TV / phone view of one department: open
// breakdowns, maintenance running or due today, and everything planned later. The data comes from the public
// `getDepartmentDisplay` callable (functions/src/displays); the logic that decides what is shown lives on the
// server (functions/src/displays/displayLogic.js).

import type { UserRole } from '@/types/auth';

/** Who may share a department (supervisor: own department, plant manager: own plant, admin: all). */
export const DISPLAY_MANAGER_ROLES: UserRole[] = ['supervisor', 'plant_manager', 'admin'];

export function canManageDepartmentDisplay(role: UserRole | null | undefined): boolean {
  return !!role && DISPLAY_MANAGER_ROLES.includes(role);
}

export type DisplayBreakdownStatus = 'reported' | 'attending' | 'waiting_parts' | 'fixed';
export type DisplayMaintenanceStatus = 'running' | 'waiting_parts' | 'scheduled_today';

export interface DisplayBreakdown {
  machine: string;
  what: string;
  status: DisplayBreakdownStatus;
  /** 0 reported · 1 attending · 2 waiting for parts · 3 fixed */
  step: 0 | 1 | 2 | 3;
  /** When it was reported (ms). */
  at: number;
  fixed: boolean;
  fresh: boolean;
}

export interface DisplayMaintenance {
  machine: string;
  what: string;
  type: 'WO' | 'PM';
  status: DisplayMaintenanceStatus;
  from: number;
  to: number;
  stopMin: number;
}

export interface DisplayScheduled {
  machine: string;
  what: string;
  type: 'WO' | 'PM';
  from: number;
  to: number;
  stopMin: number;
}

export type DisplayData =
  | { enabled: false }
  | {
      enabled: true;
      department: string;
      plantName: string;
      language: string;
      now: number;
      breakdowns: DisplayBreakdown[];
      maintenance: DisplayMaintenance[];
      scheduled: DisplayScheduled[];
    };

export interface DepartmentDisplayLink {
  token: string;
  enabled: boolean;
  language: string;
}

export interface DisplayDepartmentRow {
  plantId: string;
  plantName: string;
  name: string;
  display: DepartmentDisplayLink | null;
}

/** The viewer's own "today" (local midnight to next local midnight), sent to the server. */
export function todayWindow(now: Date = new Date()): { dayStartMs: number; dayEndMs: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { dayStartMs: start.getTime(), dayEndMs: end.getTime() };
}

/** Minutes a breakdown has been open, split for display. */
export function openFor(atMs: number, nowMs: number): { hours: number; minutes: number } {
  const total = Math.max(1, Math.round((nowMs - atMs) / 60000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** 0–100 share of a planned job that has elapsed. */
export function progressPercent(fromMs: number, toMs: number, nowMs: number): number {
  if (toMs <= fromMs) return 0;
  return Math.min(100, Math.max(0, Math.round(((nowMs - fromMs) / (toMs - fromMs)) * 100)));
}

/** PM schedules are due on a date, not at a time: local midnight means "no time of day". */
export function isAllDay(ms: number): boolean {
  const d = new Date(ms);
  return d.getHours() === 0 && d.getMinutes() === 0;
}

/** Whole days from today (local) to the given day. */
export function daysFromToday(ms: number, nowMs: number): number {
  const a = new Date(nowMs);
  const b = new Date(ms);
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const day = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((day - start) / 86400000);
}

export interface MonthGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Groups items (already sorted by `from`) by calendar month, with a localized "November 2026" label. */
export function groupByMonth<T extends { from: number }>(items: T[], locale: string): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  for (const item of items) {
    const d = new Date(item.from);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: fmt.format(d), items: [item] });
  }
  return groups;
}

/** Intl locale for an app language code (the app uses en-US as its English). */
export function intlLocale(appLanguage: string): string {
  switch (appLanguage) {
    case 'en-US':
    case 'en-GB':
    case 'en':
      return 'en-GB';
    case 'si':
      return 'si-LK';
    case 'ta':
      return 'ta-LK';
    case 'zh':
      return 'zh-CN';
    case 'ja':
      return 'ja-JP';
    default:
      return appLanguage;
  }
}

/** Language names in their own script, so floor staff can find theirs in the drop-down. Same codes as SUPPORTED_LANGUAGES. */
export const LANGUAGE_NATIVE_NAMES: Record<string, string> = {
  'en-US': 'English',
  si: 'සිංහල',
  ta: 'தமிழ்',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
};

/** The shareable link for a token, on the current site. */
export function displayUrl(token: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/display/${token}`;
}
