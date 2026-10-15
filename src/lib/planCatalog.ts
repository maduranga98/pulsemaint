import type { CountLimitKey, EnterpriseTier, Plan, PlanLimitConfig } from './planLimits';

// Display data for the plan tables on the Billing page and in the platform
// console. The numbers and the feature locks are read from planLimits.ts (the
// same source that is enforced), so the tables can never drift from what the
// app really allows. Only prices and labels live here. All prices are USD.

export interface PlanPrice {
  monthly: number | null;
  /** About 17% off paying monthly (roughly 2.4 months free). */
  yearly: number | null;
}

export const PLAN_PRICES: Record<Plan, PlanPrice> = {
  starter: { monthly: 29, yearly: 278 },
  workshop: { monthly: 79, yearly: 758 },
  factory: { monthly: 199, yearly: 1910 },
  enterprise: { monthly: null, yearly: null },
};

export const PLAN_ORDER: Plan[] = ['starter', 'workshop', 'factory', 'enterprise'];

export const PLAN_DISPLAY_NAME: Record<Plan, string> = {
  starter: 'Basic',
  workshop: 'Workshop',
  factory: 'Factory Pro',
  enterprise: 'Enterprise',
};

export const COUNT_LIMIT_ROWS: Array<{ key: CountLimitKey; label: string; perMonth?: boolean }> = [
  { key: 'users', label: 'Total users (all roles together)' },
  { key: 'plants', label: 'Plants registered in the company' },
  { key: 'machines', label: 'Machines' },
  { key: 'inventoryItems', label: 'Inventory items' },
  { key: 'pmSchedules', label: 'PM schedules' },
  { key: 'workOrdersPerMonth', label: 'Work orders per month', perMonth: true },
];

export const LOCKED_FEATURE_ROWS: Array<{ key: keyof PlanLimitConfig['features']; label: string }> = [
  { key: 'purchaseOrders', label: 'Purchase orders' },
  { key: 'autoPOEmail', label: 'Automatic PO email to suppliers' },
  { key: 'qrLowStockAlerts', label: 'QR scan inventory & low-stock alerts' },
  { key: 'contractors', label: 'Contractor management' },
  { key: 'analyticsReports', label: 'Analytics, reports export & Google Sheets export' },
  { key: 'aiAssist', label: 'AI suggestions & translation' },
  { key: 'moeAnalytics', label: 'MOE analytics' },
  { key: 'advancedAnalytics', label: 'Advanced analytics (plants & team tabs, scheduled reports)' },
  { key: 'audits', label: 'Audits' },
];

/** "Unlimited", a count, or "N / month" — for one cell of the limits table. */
export function formatLimit(value: number | null, perMonth = false): string {
  if (value === null) return 'Unlimited';
  const n = value.toLocaleString('en-US');
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
  { id: 'enterprise1', name: 'Enterprise 1', monthly: 499, yearly: 4790 },
  { id: 'enterprise2', name: 'Enterprise 2', monthly: 999, yearly: 9590 },
  { id: 'enterprise3', name: 'Enterprise 3', monthly: 1999, yearly: 19190 },
  { id: 'unlimited', name: 'Enterprise Unlimited', monthly: 3500, yearly: 33600, from: true },
];

export const ENTERPRISE_TIER_LABEL: Record<EnterpriseTier, string> = {
  enterprise1: 'Enterprise 1',
  enterprise2: 'Enterprise 2',
  enterprise3: 'Enterprise 3',
  unlimited: 'Enterprise Unlimited',
};

/** Extras that can be added to a plan. Quoted and applied by Lumora (set as per-company limit overrides). */
export const ADDONS: Array<{ label: string; price: string; note?: string; overrideKey: CountLimitKey; step: number }> = [
  { label: 'Extra user', price: '+$8 per user / month', overrideKey: 'users', step: 1 },
  { label: 'Extra 25 machines', price: '+$10 / month', overrideKey: 'machines', step: 25 },
  { label: 'Extra plant', price: '+$49 / month', note: 'Factory only', overrideKey: 'plants', step: 1 },
];
