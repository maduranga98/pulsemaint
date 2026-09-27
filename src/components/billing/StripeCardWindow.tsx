import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Lock, X } from 'lucide-react';
import TermsCheckbox from '@/components/legal/TermsCheckbox';

// One Stripe.js instance per publishable key for the page's lifetime.
const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripeJs(publishableKey: string): Promise<Stripe | null> {
  let p = stripeCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripeCache.set(publishableKey, p);
  }
  return p;
}

interface StripeCardWindowProps {
  publishableKey: string;
  /** SetupIntent client secret. */
  clientSecret: string;
  onClose: () => void;
  /** Called with the confirmed SetupIntent id. */
  onSuccess: (setupIntentId: string) => Promise<void> | void;
}

function CardForm({ onSuccess }: Pick<StripeCardWindowProps, 'onSuccess'>) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !acceptedTerms) return;
    setSubmitting(true);
    setError('');
    try {
      // 3-D Secure etc. opens as Stripe's own overlay on this page; no
      // redirect unless the card's bank insists on one.
      const { error: err, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}/app/billing` },
      });
      if (err) throw err;
      if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error(t('common.billing.account.window.notConfirmed'));
      await onSuccess(setupIntent.id);
    } catch (err: any) {
      setError(err?.message || t('common.billing.account.window.failed'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <p className="text-sm font-medium text-slate-300!">{t('common.billing.account.window.cardInformation')}</p>
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() => setError(t('common.billing.account.window.loadFailed'))}
        // Card only, without Link's "save my info" block, keeps the window short.
        options={{ layout: 'tabs', wallets: { link: 'never' }, fields: { billingDetails: { address: 'auto' } } }}
      />
      <div className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
        <TermsCheckbox
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          statement={t('common.legal.terms.cardStatement')}
        />
      </div>
      {error && <p className="text-sm text-red-400! break-words">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || !ready || submitting || !acceptedTerms}
        className="relative w-full rounded-lg bg-[#0074FF] py-3 text-base font-semibold text-white! hover:bg-[#0062d9] disabled:opacity-60"
      >
        {submitting ? t('common.billing.account.window.processing') : t('common.billing.account.window.saveCard')}
        <Lock className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-80" />
      </button>
      <p className="text-center text-xs text-slate-400!">{t('common.billing.account.window.secure')}</p>
    </form>
  );
}

/**
 * In-page Stripe card window (Stripe Elements in a sheet over the Billing
 * page) for saving a card. Card details go straight from
 * Stripe's secure fields to Stripe — FirmiCore never receives them.
 */
export default function StripeCardWindow(props: StripeCardWindowProps) {
  const { publishableKey, clientSecret, onClose, onSuccess } = props;
  const { t } = useTranslation();
  const stripePromise = useMemo(() => getStripeJs(publishableKey), [publishableKey]);

  return (
    // The overlay scrolls, and the sheet never exceeds the viewport, so the
    // title, close button and Save card stay reachable on short screens.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#1E3A5F] px-6 pt-5 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white!">{t('common.billing.account.window.addCardTitle')}</h3>
              <p className="mt-1 text-sm text-slate-300!">{t('common.billing.account.window.setupSubtitle')}</p>
            </div>
            <button onClick={onClose} className="-mr-1 rounded p-1 text-slate-300 hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#3B82F6',
                    colorBackground: '#0A1628',
                    colorText: '#F0F4F8',
                    colorTextSecondary: '#B8C7DB',
                    colorTextPlaceholder: '#8BA3BF',
                    borderRadius: '8px',
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                  },
                },
              }}
            >
              <CardForm onSuccess={onSuccess} />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}
