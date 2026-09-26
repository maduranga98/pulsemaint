const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey } = require("./stripeClient");
const { requireBillingAdmin, ensureStripeCustomer } = require("./billingAccess");

// Plan prices are in USD, so account credit is kept in USD too (a Stripe
// customer's balance is single-currency).
const TOPUP_CURRENCY = "usd";
const TOPUP_MIN = 10;
const TOPUP_MAX = 10000;

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
  try {
    const customer = await ensureStripeCustomer(ctx, request.auth.token?.email);
    const intent = await getStripe().setupIntents.create({
      customer,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { companyId: ctx.companyId },
    });
    return { clientSecret: intent.client_secret, publishableKey: publishableKey() };
  } catch (err) {
    logger.error("createCardSetup failed", err);
    throw new HttpsError("internal", "Failed to start adding the card");
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

/**
 * Starts an account credit top-up. With `paymentMethodId` (a saved card) the
 * charge is confirmed server-side straight away; otherwise the returned
 * client secret is confirmed in the in-page card window, which also saves
 * the card for next time. Either way `confirmTopUp` credits the balance.
 */
exports.createTopUpPayment = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { amount, paymentMethodId } = request.data ?? {};
  if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
    throw new HttpsError("invalid-argument", `Top-up amount must be a whole number between ${TOPUP_MIN} and ${TOPUP_MAX}`);
  }
  const ctx = await requireBillingAdmin(request);
  const stripe = getStripe();
  const customer = await ensureStripeCustomer(ctx, request.auth.token?.email);

  if (paymentMethodId !== undefined && paymentMethodId !== null) {
    if (typeof paymentMethodId !== "string" || !paymentMethodId.startsWith("pm_")) {
      throw new HttpsError("invalid-argument", "Invalid card");
    }
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId).catch(() => null);
    if (!pm || pm.customer !== customer) throw new HttpsError("permission-denied", "Card belongs to another account");
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: TOPUP_CURRENCY,
      customer,
      description: "FirmiCore account credit top-up",
      payment_method_types: ["card"],
      metadata: { companyId: ctx.companyId, type: "topup" },
      receipt_email: request.auth.token?.email ?? undefined,
      ...(paymentMethodId
        ? { payment_method: paymentMethodId, confirm: true }
        : { setup_future_usage: "off_session" }),
    });
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      publishableKey: publishableKey(),
    };
  } catch (err) {
    logger.error("createTopUpPayment failed", err);
    // Card declines surface Stripe's own reason (e.g. insufficient funds).
    const message = err?.type === "StripeCardError" ? err.message : "Failed to start the top-up payment";
    throw new HttpsError(err?.type === "StripeCardError" ? "failed-precondition" : "internal", message);
  }
});

/**
 * Credits a succeeded top-up payment to the customer's balance (applied
 * automatically to upcoming invoices). Idempotent per PaymentIntent, and
 * also run by the webhook, so the credit lands even if the browser closes
 * before calling this.
 */
exports.confirmTopUp = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const { paymentIntentId } = request.data ?? {};
  if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_")) {
    throw new HttpsError("invalid-argument", "paymentIntentId is required");
  }
  const { company } = await requireBillingAdmin(request);
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!company.stripeCustomerId || intent.customer !== company.stripeCustomerId || intent.metadata?.type !== "topup") {
    throw new HttpsError("permission-denied", "Payment belongs to another account");
  }
  if (intent.status !== "succeeded") throw new HttpsError("failed-precondition", "The payment has not completed");
  await creditTopUpPayment(stripe, intent);

  // First card on the account? Make the one just used the default.
  const customer = await stripe.customers.retrieve(company.stripeCustomerId);
  const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  if (pm && !customer.deleted && !customer.invoice_settings?.default_payment_method) {
    await makeDefaultCard(stripe, company, company.stripeCustomerId, pm).catch((err) => logger.warn("default card update failed", err));
  }
  return { ok: true };
});

/** Idempotent balance credit for a succeeded top-up PaymentIntent (shared with the webhook). */
async function creditTopUpPayment(stripe, intent) {
  await stripe.customers.createBalanceTransaction(
    intent.customer,
    {
      amount: -intent.amount_received,
      currency: intent.currency,
      description: "Account credit top-up",
      metadata: { paymentIntentId: intent.id, companyId: intent.metadata?.companyId ?? "" },
    },
    { idempotencyKey: `topup-credit-${intent.id}` },
  );
}
exports.creditTopUpPayment = creditTopUpPayment;

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
  const empty = {
    hasCustomer: false, paymentMethods: [], creditBalance: 0, currency: TOPUP_CURRENCY, invoices: [],
    publishableKey: publishableKey(),
  };
  if (!company.stripeCustomerId) return empty;

  try {
    const stripe = getStripe();
    const [customer, methods, invoices, payments] = await Promise.all([
      stripe.customers.retrieve(company.stripeCustomerId),
      stripe.paymentMethods.list({ customer: company.stripeCustomerId, type: "card", limit: 20 }),
      stripe.invoices.list({ customer: company.stripeCustomerId, limit: 24 }),
      stripe.paymentIntents.list({ customer: company.stripeCustomerId, limit: 24, expand: ["data.latest_charge"] }),
    ]);
    if (customer.deleted) return empty;
    const defaultId = customer.invoice_settings?.default_payment_method ?? null;

    const invoiceRows = invoices.data
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
      }));
    // In-page top-ups are plain payments (no invoice); list them with their
    // Stripe receipt so they sit in the same history.
    const topUpRows = payments.data
      .filter((pi) => pi.metadata?.type === "topup" && pi.status === "succeeded")
      .map((pi) => ({
        id: pi.id,
        number: null,
        description: "Account credit top-up",
        created: pi.created * 1000,
        total: pi.amount_received,
        amountPaid: pi.amount_received,
        currency: pi.currency,
        status: "paid",
        hostedInvoiceUrl: typeof pi.latest_charge === "object" ? pi.latest_charge?.receipt_url ?? null : null,
        invoicePdf: null,
      }));

    return {
      hasCustomer: true,
      publishableKey: publishableKey(),
      paymentMethods: methods.data.map((pm) => describeCard(pm, typeof defaultId === "string" ? defaultId : defaultId?.id)),
      // Stripe stores credit as a negative balance; expose it as a positive
      // amount in cents.
      creditBalance: Math.max(0, -(customer.balance ?? 0)),
      currency: customer.currency ?? TOPUP_CURRENCY,
      invoices: [...invoiceRows, ...topUpRows].sort((x, y) => y.created - x.created),
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
