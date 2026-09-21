import type { CompanyProfile } from '../types/auth';

export type Plan = CompanyProfile['plan'];

export interface PlanLimitConfig {
  /** null = unlimited. */
  machines: number | null;
  inventoryItems: number | null;
  pmSchedules: number | null;
  workOrdersPerMonth: number | null;
  users: number | null;
  features: {
    /** Inventory: automatic PO email to suppliers. */
    autoPOEmail: boolean;
    /** Inventory: QR scan & low-stock alerts. */
    qrLowStockAlerts: boolean;
    contractors: boolean;
    shiftHandover: boolean;
    training: boolean;
    safety: boolean;
    moeAnalytics: boolean;
    multiSite: boolean;
  };
}

// Single source of truth for plan limits/features — kept in sync with the
// customer-facing pricing sheet (FirmiCore-Customer-Booklet.pdf) and mirrored
// in BillingPage's plan cards. Anything gated here should read from here
// rather than hardcoding numbers/flags at the call site, so the two never
// drift apart again.
export const PLAN_LIMITS: Record<Plan, PlanLimitConfig> = {
  starter: {
    machines: 10,
    inventoryItems: 10,
    pmSchedules: 10,
    workOrdersPerMonth: 50,
    users: 5,
    features: {
      autoPOEmail: false,
      qrLowStockAlerts: false,
      contractors: false,
      shiftHandover: false,
      training: false,
      safety: false,
      moeAnalytics: false,
      multiSite: false,
    },
  },
  workshop: {
    machines: 100,
    inventoryItems: 10000,
    pmSchedules: null,
    workOrdersPerMonth: null,
    users: 20,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      moeAnalytics: false,
      multiSite: false,
    },
  },
  factory: {
    machines: 1500,
    inventoryItems: null,
    pmSchedules: null,
    workOrdersPerMonth: null,
    users: 100,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      moeAnalytics: true,
      multiSite: false,
    },
  },
  enterprise: {
    machines: null,
    inventoryItems: null,
    pmSchedules: null,
    workOrdersPerMonth: null,
    users: null,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      moeAnalytics: true,
      multiSite: true,
    },
  },
};

export function planLimitsFor(plan: Plan | undefined | null): PlanLimitConfig {
  // `plan` ultimately comes from a Firestore field that isn't otherwise
  // validated client-side (e.g. set by hand in the console, or a future
  // plan id this build doesn't know about yet) — an unrecognized value
  // must not crash every PlanFeatureGate-protected page with "Cannot read
  // properties of undefined (reading 'features')".
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.starter;
}

export function isAtOrOverLimit(count: number, limit: number | null): boolean {
  if (limit === null) return false;
  return count >= limit;
}
