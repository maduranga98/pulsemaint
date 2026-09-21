import { useState } from 'react';
import { Check, Lock, Zap, Building2, Factory, Star, CreditCard, AlertTriangle, ExternalLink } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import type { CompanyProfile } from '../../types/auth';
import { createCheckoutSession, createPortalSession } from '../../services/billingService';

type Plan = CompanyProfile['plan'];
type BillingCycle = NonNullable<CompanyProfile['billingCycle']>;

interface PlanLimits {
  machines: string;
  inventoryItems: string;
  pmSchedules: string;
  workOrders: string;
  users: string;
}

interface FeatureGroup {
  category: string;
  items: string[];
}

interface PlanDef {
  id: Plan;
  name: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  priceLabel: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  limits: PlanLimits;
  featureGroups: FeatureGroup[];
  highlight?: boolean;
}

// Yearly billing is discounted 20% off (roughly 2.4 months free) vs. paying
// monthly on every paid plan — kept in sync with the customer-facing pricing
// sheet (FirmiCore-Customer-Booklet.pdf) and the Product & Sales Catalog.
const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Basic',
    monthlyPrice: 29,
    yearlyPrice: 278,
    priceLabel: '',
    description: 'For a single small team getting started.',
    icon: <Star className="h-5 w-5" />,
    color: 'text-slate-400',
    borderColor: 'border-slate-700',
    limits: { machines: '10', inventoryItems: '10', pmSchedules: '10', workOrders: '50 / month', users: '5' },
    featureGroups: [
      {
        category: 'Core Maintenance',
        items: [
          'Machine registry & QR codes',
          'Breakdown reporting',
          'Basic work orders',
          'Preventive maintenance schedules',
          'Inventory & parts catalog',
        ],
      },
    ],
  },
  {
    id: 'workshop',
    name: 'Workshop',
    monthlyPrice: 59,
    yearlyPrice: 566,
    priceLabel: '',
    description: 'For growing workshops with structured workflows.',
    icon: <Zap className="h-5 w-5" />,
    color: 'text-blue-400',
    borderColor: 'border-blue-800/60',
    limits: { machines: '100', inventoryItems: '10,000', pmSchedules: 'Unlimited', workOrders: 'Unlimited', users: '20' },
    featureGroups: [
      { category: 'Core Maintenance', items: ['Everything in Basic & exporting reports'] },
      {
        category: 'Inventory & Procurement',
        items: ['Automatic PO email to suppliers', 'Inventory, QR scan & low-stock alerts'],
      },
      {
        category: 'Team & Operations',
        items: ['Contractor management', 'Shift handover & briefings', 'Training module & Safety Workspace features'],
      },
      { category: 'Analytics & Reporting', items: ['PM compliance dashboard', 'Basic analytics'] },
    ],
  },
  {
    id: 'factory',
    name: 'Factory Pro',
    monthlyPrice: 249,
    yearlyPrice: 2390,
    priceLabel: '',
    description: 'Full MOE analytics for production facilities.',
    icon: <Factory className="h-5 w-5" />,
    color: 'text-violet-400',
    borderColor: 'border-violet-700/60',
    highlight: true,
    limits: { machines: '1,500', inventoryItems: 'Unlimited', pmSchedules: 'Unlimited', workOrders: 'Unlimited', users: '100' },
    featureGroups: [
      { category: 'Core Maintenance', items: ['Everything in Workshop'] },
      { category: 'Analytics & Reporting', items: ['MOE trend analytics & machine comparison'] },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    priceLabel: 'Custom',
    description: 'Unlimited scale with enterprise integrations.',
    icon: <Building2 className="h-5 w-5" />,
    color: 'text-amber-400',
    borderColor: 'border-amber-700/50',
    limits: { machines: 'Unlimited', inventoryItems: 'Unlimited', pmSchedules: 'Unlimited', workOrders: 'Unlimited', users: 'Unlimited' },
    featureGroups: [
      { category: 'Core Maintenance', items: ['Everything in Factory Pro'] },
      {
        category: 'Enterprise & Security',
        items: [
          'TPM maturity roadmap & 5S scorecard',
          'Multi-site management',
          'Safety Workspace',
          'Triage knowledge builder',
          'Advanced reports hub',
          'SSO / SAML',
          'Custom integrations & API',
          'Dedicated support & SLA',
        ],
      },
    ],
  },
];

const PLAN_RANK: Record<Plan, number> = {
  starter: 0,
  workshop: 1,
  factory: 2,
  enterprise: 3,
};

function planPrice(plan: PlanDef, cycle: BillingCycle): number | null {
  return cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
}

function TrialBanner({
  status,
  trialEndsAt,
}: {
  status: CompanyProfile['status'];
  trialEndsAt: Timestamp | null;
}) {
  if (status !== 'trial') return null;

  const daysLeft = trialEndsAt
    ? Math.ceil((trialEndsAt.toDate().getTime() - Date.now()) / 86_400_000)
    : null;

  const expired = daysLeft !== null && daysLeft <= 0;

  return (
    <div
      className={`rounded-xl p-4 border flex items-center gap-3 ${
        expired
          ? 'bg-red-900/20 border-red-700/50 text-red-300'
          : daysLeft !== null && daysLeft <= 7
          ? 'bg-amber-900/20 border-amber-700/50 text-amber-300'
          : 'bg-blue-900/20 border-blue-700/50 text-blue-300'
      }`}
    >
      <Zap className="h-4 w-4 shrink-0" />
      <p className="text-sm">
        {expired ? (
          <span>
            <strong>Your trial has expired.</strong> Upgrade to continue using FirmiCore.
          </span>
        ) : daysLeft !== null ? (
          <span>
            <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your trial.</strong> Upgrade
            before your trial ends to keep all your data and access.
          </span>
        ) : (
          <span>You are currently on a free trial.</span>
        )}
      </p>
    </div>
  );
}

export default function BillingPage() {
  const company = useAuthStore((s) => s.company);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const currentPlan = company?.plan ?? 'starter';
  // Local display preference only — the billing cycle actually charged is
  // whatever the active Stripe subscription is on. Changing it here just
  // changes which price the next checkout/upgrade uses.
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(company?.billingCycle ?? 'monthly');

  const [redirecting, setRedirecting] = useState<Plan | 'portal' | null>(null);
  const [error, setError] = useState('');
  const [pendingDowngrade, setPendingDowngrade] = useState<PlanDef | null>(null);

  async function startCheckout(plan: Plan, cycle: BillingCycle) {
    if (!company || !isAdmin || plan === 'enterprise') return;
    setError('');
    setRedirecting(plan);
    try {
      // Already subscribed? Send to the Stripe Billing Portal, which handles
      // switching plans on an existing subscription (proration etc.) —
      // Checkout in subscription mode would otherwise start a second,
      // duplicate subscription. Requires "customer can switch plans" to be
      // enabled in the Stripe Dashboard's Billing Portal configuration.
      const url = company.stripeSubscriptionId
        ? await createPortalSession()
        : await createCheckoutSession(plan, cycle);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to start checkout. Please try again.');
      setRedirecting(null);
    }
  }

  function handlePlanClick(plan: PlanDef) {
    if (!company || !isAdmin || plan.id === currentPlan || plan.id === 'enterprise') return;
    const isDowngrade = PLAN_RANK[plan.id] < PLAN_RANK[currentPlan];
    if (isDowngrade) {
      setPendingDowngrade(plan);
      return;
    }
    void startCheckout(plan.id, billingCycle);
  }

  async function confirmDowngrade() {
    if (!pendingDowngrade) return;
    await startCheckout(pendingDowngrade.id, billingCycle);
    setPendingDowngrade(null);
  }

  async function handleManageBilling() {
    if (!company || !isAdmin) return;
    setError('');
    setRedirecting('portal');
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to open billing portal. Please try again.');
      setRedirecting(null);
    }
  }

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <div className="bg-[#0F1E35] border-b border-[#1E3A5F] -mx-4 sm:-mx-6 lg:-mx-8 -mt-5 px-4 sm:px-6 lg:px-8 py-5">
        <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your subscription and unlock features for your team.
        </p>
      </div>

      {/* Trial banner */}
      {company && (
        <TrialBanner status={company.status} trialEndsAt={company.trialEndsAt} />
      )}

      {/* Current plan summary */}
      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current plan</p>
            <p className="text-xl font-bold text-white capitalize">
              {PLANS.find((p) => p.id === currentPlan)?.name ?? currentPlan}
            </p>
            <p className="text-sm text-slate-400 mt-0.5 capitalize">
              Status: <span className="font-medium text-slate-300">{company?.status ?? ''}</span>
              {' · '}Billed <span className="font-medium text-slate-300">{billingCycle}</span>
            </p>
          </div>
          {company?.trialEndsAt && company.status === 'trial' && (
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Trial ends</p>
              <p className="text-sm font-medium text-white">
                {company.trialEndsAt.toDate().toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/50 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex items-center bg-[#0F1E35] border border-[#1E3A5F] rounded-full p-1">
          {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              disabled={!isAdmin || !!redirecting}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                billingCycle === cycle
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cycle}
              {cycle === 'yearly' && (
                <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">Save 20%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isDowngrade = PLAN_RANK[plan.id] < PLAN_RANK[currentPlan];
          const isEnterprise = plan.id === 'enterprise';
          const price = planPrice(plan, billingCycle);

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                isCurrent
                  ? `${plan.borderColor} bg-[#0F1E35]/80 ring-1 ring-inset ${plan.borderColor}`
                  : `border-[#1E3A5F] bg-[#0A1628]/60 hover:border-slate-600`
              } ${plan.highlight && !isCurrent ? 'shadow-lg shadow-violet-900/20' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-violet-600 text-white text-[11px] font-semibold rounded-full whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div>
                <div className={`mb-2 ${plan.color}`}>{plan.icon}</div>
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                  {price === null ? (
                    <span className="text-2xl font-bold text-white">{plan.priceLabel}</span>
                  ) : price === 0 ? (
                    <span className="text-2xl font-bold text-white">Free</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-white">${price}</span>
                      <span className="text-sm text-slate-400">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{plan.description}</p>
              </div>

              {/* Plan limits */}
              <div className="rounded-lg bg-[#0A1628] border border-[#1E3A5F] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Plan limits</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Machines</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.machines}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Users</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.users}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Inventory items</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.inventoryItems}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">PM schedules</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.pmSchedules}</dd>
                  </div>
                  <div className="flex justify-between gap-2 col-span-2">
                    <dt className="text-slate-400">Work orders</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.workOrders}</dd>
                  </div>
                </dl>
              </div>

              {/* Features, grouped by category */}
              <div className="flex-1 space-y-3">
                {plan.featureGroups.map((group) => (
                  <div key={group.category}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${plan.color}`}>
                      {group.category}
                    </p>
                    <ul className="space-y-1.5">
                      {group.items.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.color}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div>
                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm font-semibold bg-[#1E3A5F] text-slate-300 border border-[#2A4A7A]">
                    Current Plan
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:info@lumoraventures.com?subject=Enterprise Plan Enquiry"
                    className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors bg-amber-700/20 hover:bg-amber-700/40 text-amber-300 border border-amber-700/50`}
                  >
                    Contact Sales
                  </a>
                ) : isAdmin ? (
                  <button
                    onClick={() => handlePlanClick(plan)}
                    disabled={!!redirecting}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isDowngrade
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                        : plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                        : 'bg-blue-700 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {redirecting === plan.id
                      ? 'Redirecting…'
                      : isDowngrade
                      ? `Downgrade to ${plan.name}`
                      : `Upgrade to ${plan.name}`}
                  </button>
                ) : (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm text-slate-500 border border-slate-700 flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Admin only
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment methods & invoices — handled entirely by Stripe's hosted
          Billing Portal, so FirmiCore never stores card data. */}
      {isAdmin && (
        <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 space-y-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" /> Payment & Invoices
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manage your saved payment methods, view past invoices, and cancel your subscription in
              Stripe's secure billing portal.
            </p>
          </div>
          <button
            onClick={() => void handleManageBilling()}
            disabled={!!redirecting || !company?.stripeCustomerId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-60"
          >
            <ExternalLink className="h-4 w-4" />
            {redirecting === 'portal' ? 'Redirecting…' : 'Manage Billing'}
          </button>
          {!company?.stripeCustomerId && (
            <p className="text-xs text-slate-500">Subscribe to a plan first to access the billing portal.</p>
          )}
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-slate-500 text-center pb-4">
        Prices shown in USD. Yearly billing saves 20% vs. paying monthly on every paid plan. Contact{' '}
        <a href="mailto:info@lumoraventures.com" className="underline hover:text-slate-400">
          info@lumoraventures.com
        </a>{' '}
        for billing questions.
      </p>

      {/* Downgrade confirmation */}
      {pendingDowngrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold text-white">Confirm downgrade</h3>
            </div>
            <p className="text-sm text-slate-300">
              You're switching from <strong>{PLANS.find((p) => p.id === currentPlan)?.name}</strong> to{' '}
              <strong>{pendingDowngrade.name}</strong>. Any unused balance from your current billing
              period is not refunded — you'll continue to be charged at the current plan's rate through
              the end of this {billingCycle === 'yearly' ? 'year' : 'month'}, and the lower {pendingDowngrade.name} rate
              takes effect on your next billing cycle. Features exclusive to your current plan will
              become unavailable immediately.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDowngrade(null)}
                className="px-4 py-2 text-sm font-medium border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDowngrade()}
                disabled={!!redirecting}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-60"
              >
                {redirecting ? 'Redirecting…' : 'Confirm Downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
