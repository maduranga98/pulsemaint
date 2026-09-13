import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

type Plan = 'starter' | 'workshop' | 'factory';
type BillingCycle = 'monthly' | 'yearly';

/**
 * Starts a Stripe Checkout session for the given plan/cycle and returns its
 * hosted URL. The caller is redirected there — FirmiCore never touches card
 * data itself. On success Stripe fires a webhook that updates the company's
 * plan in Firestore; the client never writes plan fields directly.
 */
export async function createCheckoutSession(plan: Plan, billingCycle: BillingCycle): Promise<string> {
  const fn = httpsCallable<
    { plan: Plan; billingCycle: BillingCycle; successUrl: string; cancelUrl: string },
    { url: string }
  >(functions, 'createCheckoutSession');

  const returnBase = `${window.location.origin}/app/billing`;
  const { data } = await fn({
    plan,
    billingCycle,
    successUrl: `${returnBase}?checkout=success`,
    cancelUrl: `${returnBase}?checkout=cancelled`,
  });
  return data.url;
}

/**
 * Opens the Stripe Billing Portal so an admin can manage payment methods,
 * download invoices, or cancel the subscription.
 */
export async function createPortalSession(): Promise<string> {
  const fn = httpsCallable<{ returnUrl: string }, { url: string }>(functions, 'createPortalSession');
  const { data } = await fn({ returnUrl: `${window.location.origin}/app/billing` });
  return data.url;
}
