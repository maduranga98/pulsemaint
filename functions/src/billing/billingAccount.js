const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey } = require("./stripeClient");
const { requireBillingAdmin, ensureStripeCustomer } = require("./billingAccess");

// Plan prices are in USD, so account credit is kept in USD too (a Stripe
// customer's balance is single-currency).
const TOPUP_CURRENCY = "usd";
const TOPUP_MIN = 10;
const TOPUP_MAX = 10000;

function assertReturnUrl(url, field) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpsError("invalid-argument", `${field} must be a valid URL`);
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new HttpsError("invalid-argument", `${field} must be an https URL`);
  }
}

/**
 * Opens Stripe Checkout in setup mode — Stripe's hosted window for saving a
 * card to the company's customer, without charging it. Works before any
 * subscription exists (the customer is created on demand). The webhook makes
 * the new card the default for future invoices.
 */
exports.createSetupSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { successUrl, cancelUrl } = request.data ?? {};
  assertReturnUrl(successUrl, "successUrl");
  assertReturnUrl(cancelUrl, "cancelUrl");
  const ctx = await requireBillingAdmin(request);

  try {
    const customer = await ensureStripeCustomer(ctx, request.auth.token?.email);
    const session = await getStripe().checkout.sessions.create({
      mode: "setup",
      customer,
      currency: TOPUP_CURRENCY,
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { companyId: ctx.companyId, type: "add_card" },
      setup_intent_data: { metadata: { companyId: ctx.companyId } },
    });
    return { url: session.url };
  } catch (err) {
    logger.error("createSetupSession failed", err);
    throw new HttpsError("internal", "Failed to open the add-card window");
  }
});

/**
 * Opens Stripe Checkout in payment mode for a one-off account credit top-up.
 * On payment the webhook credits the amount to the customer's Stripe balance,
 * which Stripe applies automatically to the next subscription invoices.
 */
exports.createTopUpSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { amount, successUrl, cancelUrl } = request.data ?? {};
  if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
    throw new HttpsError("invalid-argument", `Top-up amount must be a whole number between ${TOPUP_MIN} and ${TOPUP_MAX}`);
  }
  assertReturnUrl(successUrl, "successUrl");
  assertReturnUrl(cancelUrl, "cancelUrl");
  const ctx = await requireBillingAdmin(request);

  try {
    const customer = await ensureStripeCustomer(ctx, request.auth.token?.email);
    const amountCents = amount * 100;
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: TOPUP_CURRENCY,
          unit_amount: amountCents,
          product_data: { name: "FirmiCore account credit top-up" },
        },
      }],
      // An invoice (with receipt PDF) for the top-up, so it shows in the
      // company's billing history next to subscription invoices.
      invoice_creation: { enabled: true, invoice_data: { metadata: { companyId: ctx.companyId, type: "topup" } } },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { companyId: ctx.companyId, type: "topup", amountCents: String(amountCents) },
    });
    return { url: session.url };
  } catch (err) {
    logger.error("createTopUpSession failed", err);
    throw new HttpsError("internal", "Failed to open the top-up window");
  }
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
 * Stripe: saved cards (and which is default), the account credit balance,
 * and invoice history (subscription invoices and top-up receipts).
 */
exports.getBillingOverview = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { company } = await requireBillingAdmin(request);
  if (!company.stripeCustomerId) {
    return { hasCustomer: false, paymentMethods: [], creditBalance: 0, currency: TOPUP_CURRENCY, invoices: [] };
  }

  try {
    const stripe = getStripe();
    const [customer, methods, invoices] = await Promise.all([
      stripe.customers.retrieve(company.stripeCustomerId),
      stripe.paymentMethods.list({ customer: company.stripeCustomerId, type: "card", limit: 20 }),
      stripe.invoices.list({ customer: company.stripeCustomerId, limit: 24 }),
    ]);
    if (customer.deleted) {
      return { hasCustomer: false, paymentMethods: [], creditBalance: 0, currency: TOPUP_CURRENCY, invoices: [] };
    }
    const defaultId = customer.invoice_settings?.default_payment_method ?? null;

    return {
      hasCustomer: true,
      paymentMethods: methods.data.map((pm) => describeCard(pm, typeof defaultId === "string" ? defaultId : defaultId?.id)),
      // Stripe stores credit as a negative balance; expose it as a positive
      // amount in cents.
      creditBalance: Math.max(0, -(customer.balance ?? 0)),
      currency: customer.currency ?? TOPUP_CURRENCY,
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
    logger.error("getBillingOverview failed", err);
    throw new HttpsError("internal", "Failed to load billing details");
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
    throw new HttpsError("internal", "Failed to update the card");
  }
});
