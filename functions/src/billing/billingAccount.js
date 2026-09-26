const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey } = require("./stripeClient");
const { requireBillingAdmin, ensureStripeCustomer, isMissingResource, stripeErrorMessage } = require("./billingAccess");

// Plan prices are in USD.
const CURRENCY = "usd";

// Stripe publishable key for the in-page card window (Stripe Elements).
// Public by design — kept in functions/.env next to the price IDs and handed
// to the client, so the web app needs no extra build-time config.
const publishableKey = () => process.env.STRIPE_PUBLISHABLE_KEY || null;

async function makeDefaultCard(stripe, company, customer, paymentMethodId) {
  await stripe.customers.update(customer, { invoice_settings: { default_payment_method: paymentMethodId } });
  if (company.stripeSubscriptionId && company.subscriptionStatus !== "canceled") {
    try {
      await stripe.subscriptions.update(company.stripeSubscriptionId, { default_payment_method: paymentMethodId });
    } catch (err) {
      logger.warn(`Could not set default card on subscription ${company.stripeSubscriptionId}`, err);
    }
  }
}

/**
 * Starts saving a card in the in-page Stripe card window: returns a
 * SetupIntent client secret for Stripe Elements. Works before any plan is
 * subscribed (the Stripe customer is created on demand).
 */
exports.createCardSetup = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const ctx = await requireBillingAdmin(request);
  const key = publishableKey();
  if (!key) {
    throw new HttpsError(
      "failed-precondition",
      "Card payments aren't set up yet: STRIPE_PUBLISHABLE_KEY is missing from functions/.env",
    );
  }
  try {
    const customer = await ensureStripeCustomer(ctx, request.auth.token?.email);
    const intent = await getStripe().setupIntents.create({
      customer,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { companyId: ctx.companyId },
    });
    return { clientSecret: intent.client_secret, publishableKey: key };
  } catch (err) {
    logger.error("createCardSetup failed", err);
    throw new HttpsError("internal", stripeErrorMessage(err, "Failed to start adding the card"));
  }
});

/**
 * Called after the card window confirms the SetupIntent: verifies it belongs
 * to this company and succeeded, then makes the card the default for
 * invoices (and the active subscription).
 */
exports.finalizeCardSetup = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { setupIntentId } = request.data ?? {};
  if (typeof setupIntentId !== "string" || !setupIntentId.startsWith("seti_")) {
    throw new HttpsError("invalid-argument", "setupIntentId is required");
  }
  const { company } = await requireBillingAdmin(request);
  const stripe = getStripe();
  const intent = await stripe.setupIntents.retrieve(setupIntentId);
  if (!company.stripeCustomerId || intent.customer !== company.stripeCustomerId) {
    throw new HttpsError("permission-denied", "Card setup belongs to another account");
  }
  if (intent.status !== "succeeded") throw new HttpsError("failed-precondition", "The card was not confirmed");
  const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  if (pm) await makeDefaultCard(stripe, company, company.stripeCustomerId, pm);
  return { ok: true };
});

function describeCard(pm, defaultId) {
  return {
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "",
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
    isDefault: pm.id === defaultId,
  };
}

/**
 * Everything the Billing page's account section shows, read live from
 * Stripe: saved cards (and which is default) and invoice history.
 */
exports.getBillingOverview = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { company } = await requireBillingAdmin(request);
  const empty = { hasCustomer: false, paymentMethods: [], currency: CURRENCY, invoices: [], publishableKey: publishableKey() };
  if (!company.stripeCustomerId) return empty;

  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(company.stripeCustomerId);
    if (customer.deleted) return empty;
    const [methods, invoices] = await Promise.all([
      stripe.paymentMethods.list({ customer: company.stripeCustomerId, type: "card", limit: 20 }),
      stripe.invoices.list({ customer: company.stripeCustomerId, limit: 24 }),
    ]);
    const defaultId = customer.invoice_settings?.default_payment_method ?? null;

    return {
      hasCustomer: true,
      publishableKey: publishableKey(),
      paymentMethods: methods.data.map((pm) => describeCard(pm, typeof defaultId === "string" ? defaultId : defaultId?.id)),
      currency: customer.currency ?? CURRENCY,
      invoices: invoices.data
        .filter((inv) => inv.status !== "draft")
        .map((inv) => ({
          id: inv.id,
          number: inv.number ?? null,
          description: inv.lines?.data?.[0]?.description ?? null,
          created: inv.created * 1000,
          total: inv.total,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          invoicePdf: inv.invoice_pdf ?? null,
        })),
    };
  } catch (err) {
    // A stored customer the current Stripe key can't see (e.g. created in
    // test mode, now running live): show an empty account — adding a card
    // replaces the customer.
    if (isMissingResource(err)) return empty;
    logger.error("getBillingOverview failed", err);
    throw new HttpsError("internal", stripeErrorMessage(err, "Failed to load billing details"));
  }
});

/**
 * Makes a saved card the default for invoices, or removes it. The card must
 * belong to the caller's company — checked against Stripe, not trusted from
 * the client.
 */
exports.updatePaymentMethod = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { paymentMethodId, action } = request.data ?? {};
  if (typeof paymentMethodId !== "string" || !paymentMethodId.startsWith("pm_")) {
    throw new HttpsError("invalid-argument", "paymentMethodId is required");
  }
  if (!["setDefault", "remove"].includes(action)) throw new HttpsError("invalid-argument", "Unknown action");
  const { company } = await requireBillingAdmin(request);
  if (!company.stripeCustomerId) throw new HttpsError("failed-precondition", "No saved cards");

  const stripe = getStripe();
  let pm;
  try {
    pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch {
    throw new HttpsError("not-found", "Card not found");
  }
  if (pm.customer !== company.stripeCustomerId) throw new HttpsError("permission-denied", "Card belongs to another account");

  try {
    if (action === "setDefault") {
      await stripe.customers.update(company.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      if (company.stripeSubscriptionId && company.subscriptionStatus !== "canceled") {
        await stripe.subscriptions.update(company.stripeSubscriptionId, { default_payment_method: paymentMethodId });
      }
    } else {
      await stripe.paymentMethods.detach(paymentMethodId);
    }
    return { ok: true };
  } catch (err) {
    logger.error(`updatePaymentMethod ${action} failed`, err);
    throw new HttpsError("internal", stripeErrorMessage(err, "Failed to update the card"));
  }
});
