import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

/** Platform console (Lumora Ventures superadmins) — thin wrappers over the platform* callables. */

async function call<Req, Res>(name: string, data?: Req): Promise<Res> {
  const fn = httpsCallable<Req, Res>(functions, name);
  const { data: res } = await fn(data as Req);
  return res;
}

export type PlanId = 'starter' | 'workshop' | 'factory' | 'enterprise';
export type Cycle = 'monthly' | 'yearly';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PlatformCompany {
  id: string;
  name: string;
  country: string | null;
  industry: string | null;
  plan: PlanId;
  billingCycle: Cycle;
  status: 'active' | 'trial' | 'suspended';
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialEndsAt: number | null;
  createdAt: number | null;
  stripeCustomerId: string | null;
  hasSubscription: boolean;
  monthlyValue: number;
  lastReminderAt: number | null;
  platformNote: string | null;
  /** 'platform' when Lumora assigned the plan manually (no trial; plan limits apply). */
  planSetBy: string | null;
  /** New self-registered companies are 'pending' until a superadmin approves them. */
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  approvedAt: number | null;
  userCount: number;
  adminName: string | null;
  adminEmail: string | null;
}

export interface PlatformOverview {
  totals: {
    companies: number; active: number; trial: number; suspended: number; monthly: number; yearly: number;
    mrr: number; trialsEndingSoon: number; renewalsSoon: number; pastDue: number; cancelling: number; openRequests: number;
    pendingApproval?: number;
    ratingAverage?: number | null; ratingCount?: number;
  };
  byPlan: Record<string, number>;
}

export interface PlatformUser {
  uid: string;
  plantId: string | null;
  department: string | null;
  jobTitle: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  loginMethod: string | null;
  disabled: boolean | null;
  lastSignInAt: number | null;
  isCompanyAdmin: boolean;
}

export interface PlatformInvoice {
  id: string;
  number: string | null;
  created: number;
  total: number;
  amountPaid: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  invoicePdf?: string | null;
  plan?: string | null;
  billingCycle?: Cycle | null;
  billingReason?: string | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  paidAt?: number | null;
}

export interface PlatformPlant {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  status: string;
  contactPerson: { name?: string; phone?: string; email?: string; designation?: string } | null;
  departments: string[];
  userCount: number;
}

export interface PlatformCompanyProfile {
  tradeName: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
  onboardingCompletedAt: number | null;
  contact: { name: string | null; email: string | null; phone: string | null; jobTitle: string | null } | null;
}

export interface PlatformCompanyDetail {
  company: PlatformCompany;
  profile: PlatformCompanyProfile;
  plants: PlatformPlant[];
  unassignedDepartments: string[];
  users: PlatformUser[];
  stripe: {
    subscription: {
      id: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null;
      amount: number | null; currency: string | null; interval: string | null;
    } | null;
    invoices: PlatformInvoice[];
    error: string | null;
  };
  requests: { id: string; subject: string; type: string; status: string; createdAt: number | null }[];
}

export interface PlatformPayment extends PlatformInvoice {
  companyId: string | null;
  companyName: string | null;
  amountDue: number;
  attemptCount: number;
  nextAttempt: number | null;
  description: string | null;
  plan: string;
  billingCycle: Cycle;
}

export type CompanyAction =
  | { action: 'approve' }
  | { action: 'reject'; reason: string }
  | { action: 'suspend' }
  | { action: 'reactivate' }
  | { action: 'extendTrial'; days: number }
  | { action: 'setPlan'; plan: PlanId; billingCycle: Cycle }
  | { action: 'cancelSubscription' }
  | { action: 'resumeSubscription' }
  | { action: 'note'; text: string };

export type UserAction =
  | { action: 'resetLink' }
  | { action: 'setPassword'; password: string }
  | { action: 'setRole'; role: string }
  | { action: 'updateEmail'; email: string }
  | { action: 'disable' }
  | { action: 'enable' };

export const platformService = {
  claimSuperadmin: () => call<void, { ok: boolean }>('platformClaimSuperadmin'),
  overview: () => call<void, PlatformOverview>('platformOverview'),
  listCompanies: () => call<void, { companies: PlatformCompany[] }>('platformListCompanies'),
  getCompany: (companyId: string) => call<{ companyId: string }, PlatformCompanyDetail>('platformGetCompany', { companyId }),
  updateCompany: (companyId: string, change: CompanyAction) => call('platformUpdateCompany', { companyId, ...change }),
  manageUser: (companyId: string, uid: string, change: UserAction) =>
    call<Record<string, unknown>, { ok: boolean; link?: string }>('platformManageUser', { companyId, uid, ...change }),
  auditLog: (companyId?: string) =>
    call<{ companyId?: string }, { entries: { id: string; action: string; actorEmail: string | null; companyName: string | null; companyId: string | null; createdAt: number | null }[] }>(
      'platformAuditLog',
      companyId ? { companyId } : {},
    ),
  listPayments: () => call<void, { payments: PlatformPayment[] }>('platformListPayments'),
};

export function errorText(err: unknown, fallback = 'Something went wrong'): string {
  const msg = (err as { message?: string })?.message;
  return msg && msg !== 'internal' ? msg : fallback;
}
