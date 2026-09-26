import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Lock, Zap, Building2, Factory, Star, AlertTriangle } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import type { CompanyProfile } from '../../types/auth';
import { createCheckoutSession, createPortalSession } from '../../services/billingService';
import { PLAN_LIMITS, type PlanLimitConfig } from '../../lib/planLimits';
import BillingAccountPanel from '../../components/billing/BillingAccountPanel';

type Plan = CompanyProfile['plan'];
type BillingCycle = NonNullable<CompanyProfile['billingCycle']>;

interface PlanLimits {
  machines: string;
  inventoryItems: string;
  pmSchedules: string;
  workOrders: string;
  users: string;
}

// "Unlimited" itself is translated at render time (t('common.billing.unlimited'))
// — these display strings only carry the numbers/format, not full copy.
function fmtNumber(n: number | null): string {
  return n === null ? '' : n.toLocaleString();
}

// Derives the display strings from the single numeric source of truth
// (PLAN_LIMITS in lib/planLimits.ts, also used for actual enforcement) so
// this card's numbers can never drift from what's really enforced.
function limitsFor(plan: Plan): PlanLimits {
  const c: PlanLimitConfig = PLAN_LIMITS[plan];
  return {
    machines: fmtNumber(c.machines),
    inventoryItems: fmtNumber(c.inventoryItems),
    pmSchedules: fmtNumber(c.pmSchedules),
    workOrders: c.workOrdersPerMonth === null ? '' : `${c.workOrdersPerMonth}`,
    users: fmtNumber(c.users),
  };
}

interface FeatureGroup {
  categoryKey: string;
  itemKeys: string[];
}

interface PlanDef {
  id: Plan;
  nameKey: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  descriptionKey: string;
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
// Copy lives under common.billing.plans.<id>/common.billing.features.<key> in
// the locale files — this array only holds the keys and the numbers.
const PLANS: PlanDef[] = [
  {
    id: 'starter',
    nameKey: 'common.billing.plans.starter.name',
    monthlyPrice: 29,
    yearlyPrice: 278,
    descriptionKey: 'common.billing.plans.starter.description',
    icon: <Star className="h-5 w-5" />,
    color: 'text-slate-400',
    borderColor: 'border-slate-700',
    limits: limitsFor('starter'),
    featureGroups: [
      {
        categoryKey: 'common.billing.categories.coreMaintenance',
        itemKeys: [
          'machineRegistryQr',
          'breakdownReporting',
          'basicWorkOrders',
          'pmSchedulesFeature',
          'inventoryPartsCatalog',
        ],
      },
    ],
  },
  {
    id: 'workshop',
    nameKey: 'common.billing.plans.workshop.name',
    monthlyPrice: 59,
    yearlyPrice: 566,
    descriptionKey: 'common.billing.plans.workshop.description',
    icon: <Zap className="h-5 w-5" />,
    color: 'text-blue-400',
    borderColor: 'border-blue-800/60',
    limits: limitsFor('workshop'),
    featureGroups: [
      { categoryKey: 'common.billing.categories.coreMaintenance', itemKeys: ['everythingInBasicExporting'] },
      {
        categoryKey: 'common.billing.categories.inventoryProcurement',
        itemKeys: ['autoPoEmail', 'qrScanLowStock'],
      },
      {
        categoryKey: 'common.billing.categories.teamOperations',
        itemKeys: ['contractorManagement', 'shiftHandoverBriefings', 'trainingSafetyWorkspace'],
      },
      { categoryKey: 'common.billing.categories.analyticsReporting', itemKeys: ['pmComplianceDashboard', 'basicAnalytics'] },
    ],
  },
  {
    id: 'factory',
    nameKey: 'common.billing.plans.factory.name',
    monthlyPrice: 249,
    yearlyPrice: 2390,
    descriptionKey: 'common.billing.plans.factory.description',
    icon: <Factory className="h-5 w-5" />,
    color: 'text-violet-400',
    borderColor: 'border-violet-700/60',
    highlight: true,
    limits: limitsFor('factory'),
    featureGroups: [
      { categoryKey: 'common.billing.categories.coreMaintenance', itemKeys: ['everythingInWorkshop'] },
      { categoryKey: 'common.billing.categories.analyticsReporting', itemKeys: ['moeTrendAnalytics'] },
    ],
  },
  {
    id: 'enterprise',
    nameKey: 'common.billing.plans.enterprise.name',
    monthlyPrice: null,
    yearlyPrice: null,
    descriptionKey: 'common.billing.plans.enterprise.description',
    icon: <Building2 className="h-5 w-5" />,
    color: 'text-amber-400',
    borderColor: 'border-amber-700/50',
    limits: limitsFor('enterprise'),
    featureGroups: [
      { categoryKey: 'common.billing.categories.coreMaintenance', itemKeys: ['everythingInFactoryPro'] },
      {
        categoryKey: 'common.billing.categories.enterpriseSecurity',
        itemKeys: [
          'tpmMaturityRoadmap',
          'multiSiteManagement',
          'safetyWorkspaceFeature',
          'triageKnowledgeBuilder',
          'advancedReportsHub',
          'ssoSaml',
          'customIntegrationsApi',
          'dedicatedSupportSla',
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
  const { t } = useTranslation();
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
            <strong>{t('common.billing.trial.expiredStrong')}</strong> {t('common.billing.trial.expiredRest')}
          </span>
        ) : daysLeft !== null ? (
          <span>
            <strong>{t('common.billing.trial.daysLeftStrong', { count: daysLeft })}</strong>{' '}
            {t('common.billing.trial.daysLeftRest')}
          </span>
        ) : (
          <span>{t('common.billing.trial.onTrial')}</span>
        )}
      </p>
    </div>
  );
}

export default function BillingPage() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const currentPlan = company?.plan ?? 'starter';
  // Local display preference only — the billing cycle actually charged is
  // whatever the active Stripe subscription is on. Changing it here just
  // changes which price the next checkout/upgrade uses.
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(company?.billingCycle ?? 'monthly');

  const [redirecting, setRedirecting] = useState<Plan | null>(null);
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
      setError(err?.message || t('common.billing.errors.checkoutFailed'));
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

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <div className="bg-[#0F1E35] border-b border-[#1E3A5F] -mx-4 sm:-mx-6 lg:-mx-8 -mt-5 px-4 sm:px-6 lg:px-8 py-5">
        <h1 className="text-2xl font-bold text-white!">{t('common.billing.header.title')}</h1>
        <p className="text-sm text-slate-400 mt-1">{t('common.billing.header.subtitle')}</p>
      </div>

      {/* Trial banner */}
      {company && (
        <TrialBanner status={company.status} trialEndsAt={company.trialEndsAt} />
      )}

      {/* Current plan summary */}
      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t('common.billing.currentPlan.label')}</p>
            <p className="text-xl font-bold text-white capitalize">
              {(() => {
                const plan = PLANS.find((p) => p.id === currentPlan);
                return plan ? t(plan.nameKey) : currentPlan;
              })()}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">
              {t('common.billing.currentPlan.status')}{' '}
              <span className="font-medium text-slate-300 capitalize">{company?.status ?? ''}</span>
              {' · '}
              {t('common.billing.currentPlan.billed')}{' '}
              <span className="font-medium text-slate-300">
                {billingCycle === 'yearly' ? t('common.billing.cycle.yearly') : t('common.billing.cycle.monthly')}
              </span>
            </p>
          </div>
          {company?.trialEndsAt && company.status === 'trial' && (
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t('common.billing.currentPlan.trialEnds')}</p>
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
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                billingCycle === cycle
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cycle === 'yearly' ? t('common.billing.cycle.yearly') : t('common.billing.cycle.monthly')}
              {cycle === 'yearly' && (
                <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">{t('common.billing.cycle.save20')}</span>
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
          const planName = t(plan.nameKey);

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
                    {t('common.billing.mostPopular')}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div>
                <div className={`mb-2 ${plan.color}`}>{plan.icon}</div>
                <h3 className="text-base font-bold text-white!">{planName}</h3>
                <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                  {price === null ? (
                    <span className="text-2xl font-bold text-white">{t('common.billing.customPrice')}</span>
                  ) : price === 0 ? (
                    <span className="text-2xl font-bold text-white">{t('common.billing.free')}</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-white">${price}</span>
                      <span className="text-sm text-slate-400">
                        /{billingCycle === 'yearly' ? t('common.billing.perYear') : t('common.billing.perMonth')}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{t(plan.descriptionKey)}</p>
              </div>

              {/* Plan limits */}
              <div className="rounded-lg bg-[#0A1628] border border-[#1E3A5F] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{t('common.billing.limits.title')}</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{t('common.billing.limits.machines')}</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.machines || t('common.billing.unlimited')}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{t('common.billing.limits.users')}</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.users || t('common.billing.unlimited')}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{t('common.billing.limits.inventoryItems')}</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.inventoryItems || t('common.billing.unlimited')}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{t('common.billing.limits.pmSchedules')}</dt>
                    <dd className="font-semibold text-slate-200">{plan.limits.pmSchedules || t('common.billing.unlimited')}</dd>
                  </div>
                  <div className="flex justify-between gap-2 col-span-2">
                    <dt className="text-slate-400">{t('common.billing.limits.workOrders')}</dt>
                    <dd className="font-semibold text-slate-200">
                      {plan.limits.workOrders ? t('common.billing.limits.perMonthValue', { count: plan.limits.workOrders }) : t('common.billing.unlimited')}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Features, grouped by category */}
              <div className="flex-1 space-y-3">
                {plan.featureGroups.map((group) => (
                  <div key={group.categoryKey}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${plan.color}`}>
                      {t(group.categoryKey)}
                    </p>
                    <ul className="space-y-1.5">
                      {group.itemKeys.map((key) => (
                        <li key={key} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.color}`} />
                          {t(`common.billing.features.${key}`, {
                            basicName: t('common.billing.plans.starter.name'),
                            workshopName: t('common.billing.plans.workshop.name'),
                            factoryName: t('common.billing.plans.factory.name'),
                          })}
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
                    {t('common.billing.cta.currentPlan')}
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:info@lumoraventures.com?subject=Enterprise Plan Enquiry"
                    className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors bg-amber-700/20 hover:bg-amber-700/40 text-amber-300 border border-amber-700/50`}
                  >
                    {t('common.billing.cta.contactSales')}
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
                      ? t('common.billing.cta.redirecting')
                      : isDowngrade
                      ? t('common.billing.cta.downgradeTo', { name: planName })
                      : t('common.billing.cta.upgradeTo', { name: planName })}
                  </button>
                ) : (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm text-slate-500 border border-slate-700 flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    {t('common.billing.cta.adminOnly')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment methods, account credit & billing history. Cards are only
          entered on Stripe's hosted pages, so FirmiCore never stores card data. */}
      {isAdmin && <BillingAccountPanel hasSubscription={!!company?.stripeCustomerId} />}

      {/* Note */}
      <p className="text-xs text-slate-500 text-center pb-4">
        {t('common.billing.footer.note')}{' '}
        <a href="mailto:info@lumoraventures.com" className="underline hover:text-slate-400">
          info@lumoraventures.com
        </a>{' '}
        {t('common.billing.footer.forQuestions')}
      </p>

      {/* Downgrade confirmation */}
      {pendingDowngrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold text-white!">{t('common.billing.downgrade.title')}</h3>
            </div>
            <p className="text-sm text-slate-300">
              {t('common.billing.downgrade.body', {
                fromName: (() => {
                  const plan = PLANS.find((p) => p.id === currentPlan);
                  return plan ? t(plan.nameKey) : currentPlan;
                })(),
                toName: t(pendingDowngrade.nameKey),
                period: billingCycle === 'yearly' ? t('common.billing.cycle.yearly') : t('common.billing.cycle.monthly'),
              })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDowngrade(null)}
                className="px-4 py-2 text-sm font-medium border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800"
              >
                {t('common.actions.cancel')}
              </button>
              <button
                onClick={() => void confirmDowngrade()}
                disabled={!!redirecting}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-60"
              >
                {redirecting ? t('common.billing.cta.redirecting') : t('common.billing.downgrade.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
