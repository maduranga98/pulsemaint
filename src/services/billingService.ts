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
  paymentMethods: BillingCard[];
  /** Account credit in minor units (cents); applied to upcoming invoices. */
  creditBalance: number;
  currency: string;
  invoices: BillingInvoice[];
}

const billingReturnUrl = (flag: string) => `${window.location.origin}/app/billing?${flag}`;

/**
 * Opens Stripe's hosted add-card window (Checkout in setup mode). Works
 * before any plan is subscribed; the saved card becomes the default for
 * future invoices.
 */
export async function createSetupSession(): Promise<string> {
  const fn = httpsCallable<{ successUrl: string; cancelUrl: string }, { url: string }>(functions, 'createSetupSession');
  const { data } = await fn({ successUrl: billingReturnUrl('card=added'), cancelUrl: billingReturnUrl('card=cancelled') });
  return data.url;
}

/**
 * Opens Stripe's hosted payment window to buy account credit (whole USD,
 * 10–10,000). The credit is applied automatically to upcoming invoices.
 */
export async function createTopUpSession(amount: number): Promise<string> {
  const fn = httpsCallable<{ amount: number; successUrl: string; cancelUrl: string }, { url: string }>(
    functions,
    'createTopUpSession',
  );
  const { data } = await fn({ amount, successUrl: billingReturnUrl('topup=success'), cancelUrl: billingReturnUrl('topup=cancelled') });
  return data.url;
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
