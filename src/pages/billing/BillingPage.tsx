import { useState } from 'react';
import { Check, Lock, Zap, Building2, Factory, Star, CreditCard, Trash2, AlertTriangle } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { CompanyProfile, PaymentMethod } from '../../types/auth';

type Plan = CompanyProfile['plan'];
type BillingCycle = NonNullable<CompanyProfile['billingCycle']>;

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
  features: string[];
  highlight?: boolean;
}

// Yearly billing is discounted to roughly 10 months' worth of the monthly rate (2 months free).
const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    yearlyPrice: 0,
    priceLabel: 'Free',
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
    monthlyPrice: 49,
    yearlyPrice: 490,
    priceLabel: '',
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
    monthlyPrice: 149,
    yearlyPrice: 1490,
    priceLabel: '',
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
    monthlyPrice: null,
    yearlyPrice: null,
    priceLabel: 'Custom',
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

const SAVED_CARD_DISCOUNT = 0.05;

function formatCardBrand(cardNumber: string): PaymentMethod['brand'] {
  const digits = cardNumber.replace(/\s+/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  return 'Other';
}

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
  const billingCycle: BillingCycle = company?.billingCycle ?? 'monthly';
  const paymentMethods = company?.paymentMethods ?? [];
  const hasDefaultCard = paymentMethods.some((m) => m.isDefault);

  const [upgrading, setUpgrading] = useState<Plan | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [pendingDowngrade, setPendingDowngrade] = useState<PlanDef | null>(null);

  const [cardForm, setCardForm] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [cardError, setCardError] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  async function persistPlan(plan: Plan, cycle: BillingCycle) {
    if (!company) return;
    setUpgrading(plan);
    setError('');
    setSuccessMsg('');

    try {
      const ref = doc(db, 'companies', company.id);
      await updateDoc(ref, {
        plan,
        billingCycle: cycle,
        status: 'active',
        trialEndsAt: null,
      });

      setCompany({ ...company, plan, billingCycle: cycle, status: 'active', trialEndsAt: null });
      setSuccessMsg(`Plan updated to ${PLANS.find((p) => p.id === plan)?.name ?? plan} (billed ${cycle}).`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update plan. Please try again.');
    } finally {
      setUpgrading(null);
    }
  }

  function handlePlanClick(plan: PlanDef) {
    if (!company || !isAdmin || plan.id === currentPlan) return;
    const isDowngrade = PLAN_RANK[plan.id] < PLAN_RANK[currentPlan];
    if (isDowngrade) {
      setPendingDowngrade(plan);
      return;
    }
    void persistPlan(plan.id, billingCycle);
  }

  async function confirmDowngrade() {
    if (!pendingDowngrade) return;
    await persistPlan(pendingDowngrade.id, billingCycle);
    setPendingDowngrade(null);
  }

  async function handleCycleChange(cycle: BillingCycle) {
    if (!company || !isAdmin || cycle === billingCycle) return;
    await persistPlan(currentPlan, cycle);
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setCardError('');

    const digits = cardForm.number.replace(/\s+/g, '');
    const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(cardForm.expiry.trim());
    if (!cardForm.name.trim()) {
      setCardError('Cardholder name is required.');
      return;
    }
    if (digits.length < 12 || digits.length > 19 || !/^\d+$/.test(digits)) {
      setCardError('Enter a valid card number.');
      return;
    }
    if (!expiryMatch) {
      setCardError('Enter expiry as MM/YY.');
      return;
    }
    if (!/^\d{3,4}$/.test(cardForm.cvc.trim())) {
      setCardError('Enter a valid CVC.');
      return;
    }

    setSavingCard(true);
    try {
      const newCard: PaymentMethod = {
        id: `card_${Date.now()}`,
        brand: formatCardBrand(digits),
        last4: digits.slice(-4),
        expiryMonth: Number(expiryMatch[1]),
        expiryYear: 2000 + Number(expiryMatch[2]),
        cardholderName: cardForm.name.trim(),
        isDefault: paymentMethods.length === 0,
      };
      const updated = [...paymentMethods, newCard];
      await updateDoc(doc(db, 'companies', company.id), { paymentMethods: updated });
      setCompany({ ...company, paymentMethods: updated });
      setCardForm({ name: '', number: '', expiry: '', cvc: '' });
      setSuccessMsg('Payment method saved.');
    } catch (err: any) {
      setCardError(err?.message ?? 'Failed to save card. Please try again.');
    } finally {
      setSavingCard(false);
    }
  }

  async function handleRemoveCard(id: string) {
    if (!company) return;
    const remaining = paymentMethods.filter((m) => m.id !== id);
    if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
      remaining[0].isDefault = true;
    }
    await updateDoc(doc(db, 'companies', company.id), { paymentMethods: remaining });
    setCompany({ ...company, paymentMethods: remaining });
  }

  async function handleSetDefaultCard(id: string) {
    if (!company) return;
    const updated = paymentMethods.map((m) => ({ ...m, isDefault: m.id === id }));
    await updateDoc(doc(db, 'companies', company.id), { paymentMethods: updated });
    setCompany({ ...company, paymentMethods: updated });
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

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex items-center bg-[#0F1E35] border border-[#1E3A5F] rounded-full p-1">
          {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              onClick={() => void handleCycleChange(cycle)}
              disabled={!isAdmin || !!upgrading}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                billingCycle === cycle
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cycle}
              {cycle === 'yearly' && (
                <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">Save ~17%</span>
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
                      <span className="text-2xl font-bold text-white">
                        ${hasDefaultCard ? Math.round(price * (1 - SAVED_CARD_DISCOUNT) * 100) / 100 : price}
                      </span>
                      <span className="text-sm text-slate-400">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                      {hasDefaultCard && (
                        <span className="text-[10px] font-semibold text-emerald-400 ml-1">
                          5% saved card discount applied
                        </span>
                      )}
                    </>
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
                    onClick={() => handlePlanClick(plan)}
                    disabled={!!upgrading}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isDowngrade
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                        : plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                        : 'bg-blue-700 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {upgrading === plan.id
                      ? 'Updating…'
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

      {/* Payment methods */}
      {isAdmin && (
        <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" /> Payment Methods
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Save a card for automatic renewal — subscriptions billed to a saved card get a{' '}
              <span className="text-emerald-400 font-medium">{Math.round(SAVED_CARD_DISCOUNT * 100)}% discount</span> vs. manual invoicing.
            </p>
          </div>

          {paymentMethods.length > 0 && (
            <div className="space-y-2">
              {paymentMethods.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 border border-[#1E3A5F] rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {m.brand} •••• {m.last4}
                        {m.isDefault && (
                          <span className="ml-2 text-[10px] font-semibold text-blue-400 uppercase">Default</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {m.cardholderName} · Expires {String(m.expiryMonth).padStart(2, '0')}/{m.expiryYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!m.isDefault && (
                      <button
                        onClick={() => void handleSetDefaultCard(m.id)}
                        className="text-xs font-medium text-blue-400 hover:underline"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => void handleRemoveCard(m.id)}
                      className="text-slate-500 hover:text-red-400"
                      aria-label="Remove card"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddCard} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400">Cardholder name</label>
              <input
                type="text"
                value={cardForm.name}
                onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
                placeholder="Full name on card"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400">Card number</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardForm.number}
                onChange={(e) => setCardForm((f) => ({ ...f, number: e.target.value }))}
                className="mt-1 w-full bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
                placeholder="1234 5678 9012 3456"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Expiry (MM/YY)</label>
              <input
                type="text"
                value={cardForm.expiry}
                onChange={(e) => setCardForm((f) => ({ ...f, expiry: e.target.value }))}
                className="mt-1 w-full bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
                placeholder="MM/YY"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">CVC</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardForm.cvc}
                onChange={(e) => setCardForm((f) => ({ ...f, cvc: e.target.value }))}
                className="mt-1 w-full bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600"
                placeholder="123"
              />
            </div>
            {cardError && <p className="sm:col-span-2 text-sm text-red-400">{cardError}</p>}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={savingCard}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-60"
              >
                {savingCard ? 'Saving…' : 'Save Card'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-slate-500 text-center pb-4">
        Prices shown in USD. Yearly billing is discounted vs. paying monthly. Contact{' '}
        <a href="mailto:support@pulsemaint.com" className="underline hover:text-slate-400">
          support@pulsemaint.com
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
                disabled={!!upgrading}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-60"
              >
                {upgrading ? 'Updating…' : 'Confirm Downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
