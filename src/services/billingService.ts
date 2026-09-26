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
  /** Account credit in minor units (cents); applied to upcoming invoices. */
  creditBalance: number;
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

export interface TopUpPayment {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
  publishableKey: string | null;
}

/**
 * Starts a top-up (whole USD, 10–10,000). With a saved card's id it is
 * charged straight away; otherwise the client secret is confirmed in the
 * card window (which also saves the card).
 */
export async function createTopUpPayment(amount: number, paymentMethodId?: string | null): Promise<TopUpPayment> {
  const fn = httpsCallable<{ amount: number; paymentMethodId?: string | null }, TopUpPayment>(functions, 'createTopUpPayment');
  const { data } = await fn({ amount, paymentMethodId: paymentMethodId ?? null });
  return data;
}

/** Credits a succeeded top-up to the account balance. */
export async function confirmTopUp(paymentIntentId: string): Promise<void> {
  const fn = httpsCallable<{ paymentIntentId: string }, { ok: boolean }>(functions, 'confirmTopUp');
  await fn({ paymentIntentId });
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
