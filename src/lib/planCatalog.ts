import type { CountLimitKey, EnterpriseTier, Plan, PlanLimitConfig } from './planLimits';

// Display data for the plan tables on the Billing page and in the platform
// console. Enterprise starts from $1,000/month on an annual contract. The numbers and the feature locks are read from planLimits.ts (the
// same source that is enforced), so the tables can never drift from what the
// app really allows. Only prices and labels live here. All prices are USD.

export interface PlanPrice {
  monthly: number | null;
  /** Yearly billing = pay 10 months, get 12. */
  yearly: number | null;
  /** Enterprise: the lowest monthly price a custom quote can have. */
  minMonthly?: number;
}

export const PLAN_PRICES: Record<Plan, PlanPrice> = {
  starter: { monthly: 25, yearly: 250 },
  workshop: { monthly: 89, yearly: 890 },
  factory: { monthly: 379, yearly: 3790 },
  enterprise: { monthly: null, yearly: null, minMonthly: 1000 },
};

export const PLAN_ORDER: Plan[] = ['starter', 'workshop', 'factory', 'enterprise'];

export const PLAN_DISPLAY_NAME: Record<Plan, string> = {
  starter: 'Starter',
  workshop: 'Growth',
  factory: 'Factory',
  enterprise: 'Enterprise',
};

export const COUNT_LIMIT_ROWS: Array<{ key: CountLimitKey; label: string; perMonth?: boolean; months?: boolean }> = [
  { key: 'fullUsers', label: 'Full users (all roles except operators & trainees)' },
  { key: 'lightUsers', label: 'Light users (floor operators, trainees)' },
  { key: 'plants', label: 'Plants registered in the company' },
  { key: 'machines', label: 'Machines' },
  { key: 'workOrdersPerMonth', label: 'Work orders per month', perMonth: true },
  { key: 'breakdownsPerMonth', label: 'Breakdown reports per month', perMonth: true },
  { key: 'pmSchedules', label: 'Active PM schedules' },
  { key: 'inventoryItems', label: 'Inventory parts' },
  { key: 'contractors', label: 'Contractors' },
  { key: 'trainingModules', label: 'Training modules' },
  { key: 'aiCreditsPerMonth', label: 'AI credits per month', perMonth: true },
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
  { key: 'kaizen', label: 'Kaizen' },
  { key: 'evaluations', label: 'Evaluations' },
  { key: 'shiftHandover', label: 'Shift handover' },
  { key: 'training', label: 'Training' },
  { key: 'safety', label: 'Safety' },
];

/** Features that are open on every plan — shown under the locked-features table. */
export const OPEN_ON_EVERY_PLAN =
  'Machine registry & QR codes, breakdowns, work orders, PM scheduling, inventory & suppliers, purchase orders, reports, dashboards, ' +
  'machine health score, work request portal, triage, AI suggestions (within the monthly credits), 13 languages, CSV export, file storage (no limit).';

/** "All", "—" (none), a count, "N / month" or "N months" — for one cell of the limits table. */
export function formatLimit(value: number | null, perMonth = false, months = false): string {
  if (value === null) return months ? 'All' : 'Unlimited';
  if (value === 0) return '—';
  const n = value.toLocaleString('en-US');
  if (months) return `${n} months`;
  return perMonth ? `${n} / month` : n;
}

/**
 * Starting sizes for an Enterprise contract (the limit presets a company can be
 * put on from the console). Enterprise is quoted per customer from the rate
 * card below — these carry no list price — with a minimum of
 * PLAN_PRICES.enterprise.minMonthly per month and an annual contract.
 */
export const ENTERPRISE_PLANS: Array<{ id: EnterpriseTier; name: string }> = [
  { id: 'enterprise1', name: 'Enterprise 1' },
  { id: 'enterprise2', name: 'Enterprise 2' },
  { id: 'enterprise3', name: 'Enterprise 3' },
  { id: 'unlimited', name: 'Enterprise Unlimited' },
];

/** How an Enterprise quote is built: every line is a number in the contract. */
export const ENTERPRISE_RATE_CARD: Array<{ line: string; limit: string; price: string; volume?: string }> = [
  { line: 'Platform base', limit: 'All modules, 1 plant, standard support', price: '$500 / month' },
  { line: 'Extra plant', limit: 'Number of plants beyond the first', price: '$150 each' },
  { line: 'Full users', limit: 'Staff headcount × 1.15', price: '$9 each', volume: '51–100: $8 · 101+: $7' },
  { line: 'Light users', limit: 'Operators + trainees × 1.15', price: '$1.50 each', volume: '251+: $1.20' },
  { line: 'Machines', limit: 'Asset register × 1.25', price: '$0.60 each', volume: '1,001+: $0.40' },
  { line: 'Work orders', limit: 'Machines × 3 per month × 1.5', price: '$12 per 1,000 / mo' },
  { line: 'Breakdown reports', limit: 'Machines × 2 per month × 1.5', price: '$10 per 1,000 / mo' },
  { line: 'Inventory parts', limit: 'Catalog size × 1.25', price: '$6 per 1,000' },
  { line: 'Online records (months)', limit: 'Default 12 months; more on request', price: '$0.10 per GB online', volume: 'over 1,000 GB: $0.07' },
  { line: 'AI credits', limit: 'Full users × 15 per month', price: '$0.05 each', volume: 'over 5,000: $0.04' },
  { line: 'Longer analytics history', limit: '60 months included', price: '+$40 (120 mo) · +$100 (all)' },
  { line: 'Contractors · training modules', limit: 'Registered contractors × 1.25 · modules authored', price: '$15 per 100 each' },
  { line: 'Priority support', limit: 'Named contact, 4-business-hour reply', price: '$250 / month', volume: 'Onboarding $1,500 once' },
];

/** Rules that apply to every Enterprise quote. */
export const ENTERPRISE_RULES: string[] = [
  'Use Enterprise above 40 full users, 400 machines or 1 plant; below $1,000 sell Factory.',
  'Yearly prepay −15%; two years −20%.',
  'Above a limit: 1.5× the unit price, with a 10% allowance first.',
  'SSO, public API and SLA are not available yet — quoted only as custom development.',
];

export const ENTERPRISE_TIER_LABEL: Record<EnterpriseTier, string> = {
  enterprise1: 'Enterprise 1',
  enterprise2: 'Enterprise 2',
  enterprise3: 'Enterprise 3',
  unlimited: 'Enterprise Unlimited',
};

/** Extras that can be added to any paid plan. Quoted and applied by Lumora (set as per-company limit overrides). */
export const ADDONS: Array<{ label: string; price: string; note?: string; overrideKey?: CountLimitKey; step?: number }> = [
  { label: 'Extra full user', price: '$10 / month', overrideKey: 'fullUsers', step: 1 },
  { label: '10 extra light users', price: '$5 / month', overrideKey: 'lightUsers', step: 10 },
  { label: '25 extra machines', price: '$10 / month', overrideKey: 'machines', step: 25 },
  { label: '1,000 extra inventory parts', price: '$10 / month', overrideKey: 'inventoryItems', step: 1000 },
  { label: '500 AI credits', price: '$25', note: 'Per month', overrideKey: 'aiCreditsPerMonth', step: 500 },
  { label: '12 more months of online records', price: '$5 / $15 / $60', note: 'Starter / Growth / Factory' },
];
