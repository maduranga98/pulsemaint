const { defineSecret } = require("firebase-functions/params");
const Stripe = require("stripe");

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

let stripeClient = null;

/** Lazily-constructed Stripe SDK client, keyed off the STRIPE_SECRET_KEY secret. */
function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2024-12-18.acacia",
    });
  }
  return stripeClient;
}

// plan/billingCycle -> Stripe Price ID. Configure via functions/.env (see
// functions/.env.example) — these are not secrets, just catalog config.
const PRICE_IDS = {
  starter: { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY, yearly: process.env.STRIPE_PRICE_STARTER_YEARLY },
  workshop: { monthly: process.env.STRIPE_PRICE_WORKSHOP_MONTHLY, yearly: process.env.STRIPE_PRICE_WORKSHOP_YEARLY },
  factory: { monthly: process.env.STRIPE_PRICE_FACTORY_MONTHLY, yearly: process.env.STRIPE_PRICE_FACTORY_YEARLY },
};

function priceIdFor(plan, billingCycle) {
  return PRICE_IDS[plan]?.[billingCycle] ?? null;
}

function planAndCycleForPrice(priceId) {
  for (const [plan, cycles] of Object.entries(PRICE_IDS)) {
    for (const [billingCycle, id] of Object.entries(cycles)) {
      if (id && id === priceId) return { plan, billingCycle };
    }
  }
  return null;
}

/** Price IDs on an invoice's lines (older API: line.price; newer: line.pricing.price_details.price). */
function invoicePriceIds(invoice) {
  return (invoice?.lines?.data ?? [])
    .map((l) => (typeof l.price === "string" ? l.price : l.price?.id) ?? l.pricing?.price_details?.price ?? null)
    .filter(Boolean);
}

/**
 * True only for FirmiCore CMMS invoices — ones that bill a FirmiCore plan
 * price. The Stripe account also bills other Lumora Ventures products, and
 * those can carry similar metadata, so the price is the reliable marker.
 */
function isFirmicoreInvoice(invoice) {
  return invoicePriceIds(invoice).some((id) => planAndCycleForPrice(id) !== null);
}

/** FirmiCore plan + billing cycle an invoice bills, or null. */
function firmicorePlanOfInvoice(invoice) {
  for (const id of invoicePriceIds(invoice)) {
    const mapped = planAndCycleForPrice(id);
    if (mapped) return mapped;
  }
  return null;
}

module.exports = {
  isFirmicoreInvoice,
  firmicorePlanOfInvoice,
  getStripe,
  stripeSecretKey,
  stripeWebhookSecret,
  priceIdFor,
  planAndCycleForPrice,
};
