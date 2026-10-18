import type { CountLimitKey, EnterpriseTier, Plan, PlanLimitConfig } from './planLimits';

// Display data for the plan tables on the Billing page and in the platform
// console. Enterprise starts from $1,000/month on an annual contract. The numbers and the feature locks are read from planLimits.ts (the
// same source that is enforced), so the tables can never drift from what the
// app really allows. Only prices and labels live here. All prices are USD.

export interface PlanPrice {
  monthly: number | null;
  /** Pay 10 months, get 12 (about 17% off paying monthly). */
  yearly: number | null;
}

export const PLAN_PRICES: Record<Plan, PlanPrice> = {
  starter: { monthly: 25, yearly: 250 },
  workshop: { monthly: 89, yearly: 890 },
  factory: { monthly: 379, yearly: 3790 },
  enterprise: { monthly: null, yearly: null },
};

export const PLAN_ORDER: Plan[] = ['starter', 'workshop', 'factory', 'enterprise'];

export const PLAN_DISPLAY_NAME: Record<Plan, string> = {
  starter: 'Starter',
  workshop: 'Growth',
  factory: 'Factory',
  enterprise: 'Enterprise',
};

export const COUNT_LIMIT_ROWS: Array<{ key: CountLimitKey; label: string; perMonth?: boolean; months?: boolean }> = [
  { key: 'fullUsers', label: 'Full users (every role except floor operators and trainees)' },
  { key: 'lightUsers', label: 'Light users (floor operators and trainees)' },
  { key: 'plants', label: 'Plants registered in the company' },
  { key: 'machines', label: 'Machines' },
  { key: 'inventoryItems', label: 'Inventory parts' },
  { key: 'pmSchedules', label: 'PM schedules' },
  { key: 'workOrdersPerMonth', label: 'Work orders per month', perMonth: true },
  { key: 'aiCreditsPerMonth', label: 'AI credits per month (1 AI request = 1 credit)', perMonth: true },
  { key: 'analyticsHistoryMonths', label: 'Analytics history', months: true },
];

export const LOCKED_FEATURE_ROWS: Array<{ key: keyof PlanLimitConfig['features']; label: string }> = [
  { key: 'purchaseOrders', label: 'Purchase orders' },
  { key: 'shiftHandover', label: 'Shift handover & briefings' },
  { key: 'training', label: 'Training module' },
  { key: 'safety', label: 'Safety workspace' },
  { key: 'kaizen', label: 'Kaizen' },
  { key: 'evaluations', label: 'Evaluations' },
  { key: 'autoPOEmail', label: 'Automatic PO email to suppliers' },
  { key: 'qrLowStockAlerts', label: 'QR scan inventory & low-stock alerts' },
  { key: 'contractors', label: 'Contractor management' },
  { key: 'analyticsReports', label: 'Analytics, reports export & Google Sheets export' },
  { key: 'aiAssist', label: 'AI suggestions & translation' },
  { key: 'moeAnalytics', label: 'MOE analytics' },
  { key: 'advancedAnalytics', label: 'Advanced analytics (plants & team tabs, scheduled reports)' },
  { key: 'audits', label: 'Audits' },
];

/** Features that are open on every plan — shown under the locked-features table. */
export const OPEN_ON_EVERY_PLAN =
  'Machine registry & QR codes, breakdowns, work orders, PM scheduling, parts catalog and suppliers, dashboards, machine health score, ' +
  'work request portal, triage, CSV export, file storage (no limit).';

/** "Unlimited", a count, or "N / month" — for one cell of the limits table. */
export function formatLimit(value: number | null, perMonth = false, months = false): string {
  if (value === null) return months ? 'Full history' : 'Unlimited';
  const n = value.toLocaleString('en-US');
  if (months) return `${n} months`;
  return perMonth ? `${n} / month` : n;
}

export interface EnterprisePlanDef {
  id: EnterpriseTier;
  name: string;
  monthly: number;
  yearly: number;
  /** true = the price is a starting point, quoted per customer. */
  from?: boolean;
}

/** Sized Enterprise plans — list prices to quote from, discounted per customer. */
export const ENTERPRISE_PLANS: EnterprisePlanDef[] = [
  { id: 'enterprise1', name: 'Enterprise 1', monthly: 1000, yearly: 10000, from: true },
  { id: 'enterprise2', name: 'Enterprise 2', monthly: 2000, yearly: 20000 },
  { id: 'enterprise3', name: 'Enterprise 3', monthly: 3500, yearly: 35000 },
  { id: 'unlimited', name: 'Enterprise Unlimited', monthly: 5000, yearly: 50000, from: true },
];

export const ENTERPRISE_TIER_LABEL: Record<EnterpriseTier, string> = {
  enterprise1: 'Enterprise 1',
  enterprise2: 'Enterprise 2',
  enterprise3: 'Enterprise 3',
  unlimited: 'Enterprise Unlimited',
};

/** Extras that can be added to a plan. Quoted and applied by Lumora (set as per-company limit overrides). */
export const ADDONS: Array<{ label: string; price: string; note?: string; overrideKey: CountLimitKey; step: number }> = [
  { label: 'Extra full user', price: '+$8 per user / month', overrideKey: 'fullUsers', step: 1 },
  { label: 'Extra 25 machines', price: '+$10 / month', overrideKey: 'machines', step: 25 },
  { label: 'Extra plant', price: '+$49 / month', note: 'Factory only', overrideKey: 'plants', step: 1 },
];
