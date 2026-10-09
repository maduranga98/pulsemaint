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
/** `termsVersion` is the Terms of Service version the admin ticked before subscribing. */
export async function createCheckoutSession(plan: Plan, billingCycle: BillingCycle, termsVersion: string): Promise<string> {
  const fn = httpsCallable<
    { plan: Plan; billingCycle: BillingCycle; termsVersion: string; successUrl: string; cancelUrl: string },
    { url: string }
  >(functions, 'createCheckoutSession');

  const returnBase = `${window.location.origin}/app/billing`;
  const { data } = await fn({
    plan,
    billingCycle,
    termsVersion,
    successUrl: `${returnBase}?checkout=success`,
    cancelUrl: `${returnBase}?checkout=cancelled`,
  });
  return data.url;
}

/**
 * Opens the Stripe Billing Portal so an admin can manage payment methods,
 * download invoices, or cancel the subscription.
 */
/** Pass `termsVersion` when opening the portal to change plan/cycle after ticking the Terms. */
export async function createPortalSession(termsVersion?: string): Promise<string> {
  const fn = httpsCallable<{ returnUrl: string; termsVersion?: string }, { url: string }>(functions, 'createPortalSession');
  const { data } = await fn({ returnUrl: `${window.location.origin}/app/billing`, ...(termsVersion ? { termsVersion } : {}) });
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
/** `termsVersion` is the Terms of Service version ticked in the card window. */
export async function finalizeCardSetup(setupIntentId: string, termsVersion: string): Promise<void> {
  const fn = httpsCallable<{ setupIntentId: string; termsVersion: string }, { ok: boolean }>(functions, 'finalizeCardSetup');
  await fn({ setupIntentId, termsVersion });
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

/**
 * Company admin: cancel the subscription at the end of the paid period, ask
 * to leave FirmiCore, or (kind 'reason') answer the reason for a cancellation
 * made in the Stripe portal. A reason is always required.
 */
export async function requestCancellation(kind: 'cancel_subscription' | 'leave_system' | 'reason', reason: string, details: string): Promise<{ ok: boolean; endsAt?: number | null }> {
  const fn = httpsCallable<{ kind: string; reason: string; details: string }, { ok: boolean; endsAt?: number | null }>(functions, 'requestCancellation');
  const { data } = await fn({ kind, reason, details });
  return data;
}
