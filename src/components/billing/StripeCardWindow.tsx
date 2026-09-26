import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Lock, X } from 'lucide-react';

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
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
      <p className="text-sm font-medium text-slate-500!">{t('common.billing.account.window.cardInformation')}</p>
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() => setError(t('common.billing.account.window.loadFailed'))}
        options={{ layout: 'tabs', fields: { billingDetails: { address: 'auto' } } }}
      />
      {error && <p className="text-sm text-red-600!">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || !ready || submitting}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-end">
          <button onClick={onClose} className="-mr-1 rounded p-1 text-slate-500 hover:text-slate-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="mt-2 text-2xl font-bold text-slate-900!">{t('common.billing.account.window.addCardTitle')}</h3>
        <p className="mt-1 text-sm text-slate-500!">{t('common.billing.account.window.setupSubtitle')}</p>
        <div className="mt-5">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: { colorPrimary: '#0074FF', borderRadius: '8px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
              },
            }}
          >
            <CardForm onSuccess={onSuccess} />
          </Elements>
        </div>
      </div>
    </div>
  );
}
