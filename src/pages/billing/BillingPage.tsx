import { useState } from 'react';
import { Check, Lock, Zap, Building2, Factory, Star } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { CompanyProfile } from '../../types/auth';

type Plan = CompanyProfile['plan'];

interface PlanDef {
  id: Plan;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'For small teams getting started with maintenance tracking.',
    icon: <Star className="h-5 w-5" />,
    color: 'text-slate-400',
    borderColor: 'border-slate-700',
    features: [
      'Machine registry & QR codes',
      'Breakdown reporting',
      'Basic work orders',
      'Up to 5 users',
      'Preventive maintenance schedules',
      'Inventory & parts catalog',
    ],
  },
  {
    id: 'workshop',
    name: 'Workshop',
    price: '$49',
    period: '/month',
    description: 'For growing workshops that need structured maintenance workflows.',
    icon: <Zap className="h-5 w-5" />,
    color: 'text-blue-400',
    borderColor: 'border-blue-800/60',
    features: [
      'Everything in Starter',
      'Up to 20 users',
      'Contractor management',
      'Shift handover & briefings',
      'Training module',
      'PM compliance dashboard',
      'Basic analytics',
    ],
  },
  {
    id: 'factory',
    name: 'Factory Pro',
    price: '$149',
    period: '/month',
    description: 'Full MOE analytics and advanced modules for production facilities.',
    icon: <Factory className="h-5 w-5" />,
    color: 'text-violet-400',
    borderColor: 'border-violet-700/60',
    highlight: true,
    features: [
      'Everything in Workshop',
      'Up to 100 users',
      'MOE Trend Analytics',
      'MOE Machine Comparison',
      'Kaizen ROI & Digest',
      'Triage knowledge builder',
      'Advanced reports hub',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Unlimited scale with full TPM, 5S, and enterprise integrations.',
    icon: <Building2 className="h-5 w-5" />,
    color: 'text-amber-400',
    borderColor: 'border-amber-700/50',
    features: [
      'Everything in Factory Pro',
      'Unlimited users',
      'TPM Maturity Roadmap & Trends',
      '5S Scorecard & Best Practices',
      'Multi-site management',
      'SSO / SAML',
      'Custom integrations & API',
      'Dedicated support & SLA',
    ],
  },
];

const PLAN_RANK: Record<Plan, number> = {
  starter: 0,
  workshop: 1,
  factory: 2,
  enterprise: 3,
};

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
            <strong>Your trial has expired.</strong> Upgrade to continue using PulseMaint.
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
  const setCompany = useAuthStore((s) => s.setCompany);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const currentPlan = company?.plan ?? 'starter';
  const [upgrading, setUpgrading] = useState<Plan | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  async function handleUpgrade(plan: Plan) {
    if (!company || !isAdmin) return;
    if (plan === currentPlan) return;

    setUpgrading(plan);
    setError('');
    setSuccessMsg('');

    try {
      const ref = doc(db, 'companies', company.id);
      await updateDoc(ref, {
        plan,
        status: 'active',
        trialEndsAt: null,
      });

      setCompany({ ...company, plan, status: 'active', trialEndsAt: null });
      setSuccessMsg(`Plan updated to ${PLANS.find((p) => p.id === plan)?.name ?? plan}.`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update plan. Please try again.');
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <div className="bg-[#0F1E35] border-b border-[#1E3A5F] -mx-4 sm:-mx-6 lg:-mx-8 -mt-5 px-4 sm:px-6 lg:px-8 py-5">
        <h1 className="text-2xl font-bold text-white font-[Sora]">Billing & Plan</h1>
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
              Status: <span className="font-medium text-slate-300">{company?.status ?? '—'}</span>
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
      {successMsg && (
        <div className="rounded-xl bg-green-900/20 border border-green-700/50 p-4 text-sm text-green-300">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/50 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isDowngrade = PLAN_RANK[plan.id] < PLAN_RANK[currentPlan];
          const isEnterprise = plan.id === 'enterprise';

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
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-slate-400">{plan.period}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.color}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div>
                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm font-semibold bg-[#1E3A5F] text-slate-300 border border-[#2A4A7A]">
                    Current Plan
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:sales@pulsemaint.com?subject=Enterprise Plan Enquiry"
                    className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors bg-amber-700/20 hover:bg-amber-700/40 text-amber-300 border border-amber-700/50`}
                  >
                    Contact Sales
                  </a>
                ) : isAdmin ? (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!!upgrading || isDowngrade}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isDowngrade
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                        : 'bg-blue-700 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {upgrading === plan.id
                      ? 'Updating…'
                      : isDowngrade
                      ? 'Contact support to downgrade'
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

      {/* Note */}
      <p className="text-xs text-slate-500 text-center pb-4">
        Prices shown in USD. Enterprise plans are billed annually. Contact{' '}
        <a href="mailto:support@pulsemaint.com" className="underline hover:text-slate-400">
          support@pulsemaint.com
        </a>{' '}
        for billing questions or to request a downgrade.
      </p>
    </div>
  );
}
