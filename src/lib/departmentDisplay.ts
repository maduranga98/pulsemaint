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

export type DisplayBreakdownStatus = 'reported' | 'attended' | 'in_progress' | 'fixed';
export type DisplayMaintenanceStatus = 'running' | 'scheduled_today';

/** An open breakdown: machine, where it is in the procedure, and its times — never what happened. */
export interface DisplayBreakdown {
  machine: string;
  status: DisplayBreakdownStatus;
  /** 0 reported · 1 attended · 2 in progress · 3 fixed */
  step: 0 | 1 | 2 | 3;
  /** When it was reported (ms). */
  at: number;
  /** When it was fixed (ms); set once it is fixed and waiting for sign-off. */
  fixedAt: number | null;
  fresh: boolean;
}

/** A breakdown signed off today. */
export interface DisplayCompleted {
  machine: string;
  at: number;
  /** When it was signed off (ms). */
  fixedAt: number;
}

export interface DisplayMaintenance {
  machine: string;
  type: 'WO' | 'PM';
  status: DisplayMaintenanceStatus;
  from: number;
  to: number;
}

export interface DisplayScheduled {
  machine: string;
  type: 'WO' | 'PM';
  from: number;
  to: number;
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
      completed: DisplayCompleted[];
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
