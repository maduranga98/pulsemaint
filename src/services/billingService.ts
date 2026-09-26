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

export interface BillingCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  description: string | null;
  /** Epoch millis. */
  created: number;
  /** Minor units (cents). */
  total: number;
  amountPaid: number;
  currency: string;
  status: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

export interface BillingOverview {
  hasCustomer: boolean;
  /** Stripe publishable key for the in-page card window (null until configured). */
  publishableKey: string | null;
  paymentMethods: BillingCard[];
  currency: string;
  invoices: BillingInvoice[];
}

/**
 * Starts saving a card in the in-page Stripe card window: a SetupIntent
 * client secret for Stripe Elements, plus the publishable key to load it.
 */
export async function createCardSetup(): Promise<{ clientSecret: string; publishableKey: string | null }> {
  const fn = httpsCallable<void, { clientSecret: string; publishableKey: string | null }>(functions, 'createCardSetup');
  const { data } = await fn();
  return data;
}

/** Makes the card confirmed in the card window the default for invoices. */
export async function finalizeCardSetup(setupIntentId: string): Promise<void> {
  const fn = httpsCallable<{ setupIntentId: string }, { ok: boolean }>(functions, 'finalizeCardSetup');
  await fn({ setupIntentId });
}

/**
 * A readable message for a failed billing call. The Functions SDK reports a
 * request that never got a response (network drop, function mid-deploy) as a
 * bare "internal" — replace that with something a person can act on.
 */
export function billingErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { message?: string } | null)?.message;
  if (!message || message === 'internal' || message === 'INTERNAL') return fallback;
  return message;
}

/** Saved cards, account credit and invoice history, read live from Stripe. */
export async function getBillingOverview(): Promise<BillingOverview> {
  const fn = httpsCallable<void, BillingOverview>(functions, 'getBillingOverview');
  const { data } = await fn();
  return data;
}

export async function updatePaymentMethod(paymentMethodId: string, action: 'setDefault' | 'remove'): Promise<void> {
  const fn = httpsCallable<{ paymentMethodId: string; action: 'setDefault' | 'remove' }, { ok: boolean }>(
    functions,
    'updatePaymentMethod',
  );
  await fn({ paymentMethodId, action });
}
