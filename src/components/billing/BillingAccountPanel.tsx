import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreditCard, Plus, Wallet, Receipt, ExternalLink, Download, Trash2, Star, RefreshCw, X, CheckCircle2,
} from 'lucide-react';
import {
  createPortalSession,
  createSetupSession,
  createTopUpSession,
  getBillingOverview,
  updatePaymentMethod,
  type BillingOverview,
} from '../../services/billingService';

const TOPUP_PRESETS = [50, 100, 250, 500];
const TOPUP_MIN = 10;
const TOPUP_MAX = 10000;

function formatMoney(minor: number, currency: string): string {
  return (minor / 100).toLocaleString(undefined, { style: 'currency', currency: currency.toUpperCase() });
}

function brandLabel(brand: string): string {
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover',
    jcb: 'JCB', diners: 'Diners Club', unionpay: 'UnionPay',
  };
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
  open: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
  uncollectible: 'bg-red-900/30 text-red-300 border-red-700/50',
  void: 'bg-slate-800 text-slate-400 border-slate-600',
};

type Busy = 'card' | 'topup' | 'portal' | `pm:${string}` | null;

/**
 * Admin-only billing account section: saved cards (add through Stripe's
 * hosted window, set default, remove), prepaid account credit with a top-up
 * window, and invoice history. Card details are only ever entered on
 * Stripe's pages — FirmiCore sees brand/last 4 digits only.
 */
export default function BillingAccountPanel({ hasSubscription }: { hasSubscription: boolean }) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getBillingOverview());
      setError('');
    } catch (err: any) {
      setError(err?.message || t('common.billing.account.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Returning from a Stripe window: show the outcome, then reload. Stripe's
  // webhook (default card / credit) can land a moment after the redirect,
  // so reload once more shortly after.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const card = params.get('card');
    const topup = params.get('topup');
    if (card === 'added') setNotice(t('common.billing.account.notices.cardAdded'));
    if (topup === 'success') setNotice(t('common.billing.account.notices.topUpDone'));
    void load();
    if (card || topup) {
      params.delete('card');
      params.delete('topup');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
      const id = window.setTimeout(() => void load(), 4000);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [load, t]);

  async function redirect(kind: 'card' | 'topup' | 'portal', getUrl: () => Promise<string>, failKey: string) {
    setError('');
    setBusy(kind);
    try {
      window.location.href = await getUrl();
    } catch (err: any) {
      setError(err?.message || t(failKey));
      setBusy(null);
    }
  }

  async function handleCard(id: string, action: 'setDefault' | 'remove') {
    if (action === 'remove' && !window.confirm(t('common.billing.account.cards.confirmRemove'))) return;
    setError('');
    setBusy(`pm:${id}`);
    try {
      await updatePaymentMethod(id, action);
      await load();
    } catch (err: any) {
      setError(err?.message || t('common.billing.account.errors.cardUpdateFailed'));
    } finally {
      setBusy(null);
    }
  }

  const effectiveAmount = customAmount ? Number(customAmount) : amount;
  const amountValid = Number.isInteger(effectiveAmount) && effectiveAmount >= TOPUP_MIN && effectiveAmount <= TOPUP_MAX;
  const currency = overview?.currency ?? 'usd';

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/50 p-4 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-700/50 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment methods */}
        <section className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white! flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-400" /> {t('common.billing.account.cards.title')}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t('common.billing.account.cards.subtitle')}</p>
            </div>
            <button
              onClick={() => void redirect('card', createSetupSession, 'common.billing.account.errors.cardWindowFailed')}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-60 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              {busy === 'card' ? t('common.billing.cta.redirecting') : t('common.billing.account.cards.add')}
            </button>
          </div>

          {loading && !overview ? (
            <p className="text-sm text-slate-500">{t('common.billing.account.loading')}</p>
          ) : overview?.paymentMethods.length ? (
            <ul className="space-y-2">
              {overview.paymentMethods.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#0A1628] border border-[#1E3A5F] px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <CreditCard className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {brandLabel(pm.brand)} •••• {pm.last4}
                        {pm.isDefault && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                            {t('common.billing.account.cards.default')}
                          </span>
                        )}
                      </p>
                      {pm.expMonth && pm.expYear && (
                        <p className="text-xs text-slate-500">
                          {t('common.billing.account.cards.expires', { date: `${String(pm.expMonth).padStart(2, '0')}/${pm.expYear}` })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!pm.isDefault && (
                      <button
                        onClick={() => void handleCard(pm.id, 'setDefault')}
                        disabled={!!busy}
                        title={t('common.billing.account.cards.makeDefault')}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => void handleCard(pm.id, 'remove')}
                      disabled={!!busy}
                      title={t('common.billing.account.cards.remove')}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">{t('common.billing.account.cards.empty')}</p>
          )}

          {hasSubscription && (
            <button
              onClick={() => void redirect('portal', createPortalSession, 'common.billing.errors.portalFailed')}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-60"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {busy === 'portal' ? t('common.billing.cta.redirecting') : t('common.billing.account.portal')}
            </button>
          )}
        </section>

        {/* Account credit */}
        <section className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white! flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-400" /> {t('common.billing.account.credit.title')}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t('common.billing.account.credit.subtitle')}</p>
            </div>
            <button
              onClick={() => setTopUpOpen(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-60 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> {t('common.billing.account.credit.topUp')}
            </button>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">{t('common.billing.account.credit.balance')}</p>
            <p className="text-3xl font-bold text-white mt-1">
              {loading && !overview ? '—' : formatMoney(overview?.creditBalance ?? 0, currency)}
            </p>
          </div>
        </section>
      </div>

      {/* Billing history */}
      <section className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white! flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-400" /> {t('common.billing.account.history.title')}
          </h2>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('common.billing.account.refresh')}
          </button>
        </div>
        {overview?.invoices.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-[#1E3A5F]">
                  <th className="py-2 pr-3 font-semibold">{t('common.billing.account.history.date')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('common.billing.account.history.description')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('common.billing.account.history.amount')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('common.billing.account.history.status')}</th>
                  <th className="py-2 font-semibold text-right">{t('common.billing.account.history.invoice')}</th>
                </tr>
              </thead>
              <tbody>
                {overview.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[#1E3A5F]/60 last:border-0">
                    <td className="py-2.5 pr-3 text-slate-300 whitespace-nowrap">
                      {new Date(inv.created).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300">
                      <span className="block truncate max-w-[18rem]">{inv.description || inv.number || '—'}</span>
                      {inv.number && inv.description && <span className="text-xs text-slate-500">{inv.number}</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-white font-semibold whitespace-nowrap">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_STYLES[inv.status ?? ''] ?? STATUS_STYLES.void}`}>
                        {inv.status ? t(`common.billing.account.history.statuses.${inv.status}`, { defaultValue: inv.status }) : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {inv.hostedInvoiceUrl && (
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-300! hover:text-blue-200! mr-3">
                          <ExternalLink className="h-3.5 w-3.5" /> {t('common.billing.account.history.view')}
                        </a>
                      )}
                      {inv.invoicePdf && (
                        <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-300! hover:text-white!">
                          <Download className="h-3.5 w-3.5" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {loading ? t('common.billing.account.loading') : t('common.billing.account.history.empty')}
          </p>
        )}
      </section>

      {/* Top-up window */}
      {topUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white! flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-400" /> {t('common.billing.account.topUp.title')}
              </h3>
              <button onClick={() => setTopUpOpen(false)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400">{t('common.billing.account.topUp.body')}</p>
            <div className="grid grid-cols-4 gap-2">
              {TOPUP_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setAmount(preset); setCustomAmount(''); }}
                  className={`py-2 rounded-lg text-sm font-semibold border ${
                    !customAmount && amount === preset
                      ? 'bg-emerald-700 border-emerald-600 text-white'
                      : 'bg-[#0A1628] border-[#1E3A5F] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-xs text-slate-400">{t('common.billing.account.topUp.custom')}</span>
              <div className="mt-1 flex items-center rounded-lg bg-[#0A1628] border border-[#1E3A5F] px-3">
                <span className="text-slate-500 text-sm">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={TOPUP_MIN}
                  max={TOPUP_MAX}
                  step={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={String(amount)}
                  className="w-full bg-transparent py-2 pl-1 text-sm text-white outline-none"
                />
              </div>
              {!amountValid && (
                <span className="text-xs text-red-300">
                  {t('common.billing.account.topUp.range', { min: TOPUP_MIN, max: TOPUP_MAX.toLocaleString() })}
                </span>
              )}
            </label>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTopUpOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800"
              >
                {t('common.actions.cancel')}
              </button>
              <button
                onClick={() => void redirect('topup', () => createTopUpSession(effectiveAmount), 'common.billing.account.errors.topUpWindowFailed')}
                disabled={!amountValid || !!busy}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-60"
              >
                {busy === 'topup'
                  ? t('common.billing.cta.redirecting')
                  : t('common.billing.account.topUp.pay', { amount: amountValid ? `$${effectiveAmount.toLocaleString()}` : '' })}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">{t('common.billing.account.topUp.secure')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
