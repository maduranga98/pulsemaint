const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey, stripeWebhookSecret, planAndCycleForPrice } = require("./stripeClient");
const { creditTopUpPayment } = require("./billingAccount");

const db = getFirestore("default");

async function syncSubscriptionToCompany(subscription) {
  const companyId = subscription.metadata?.companyId;
  if (!companyId) {
    logger.warn(`Stripe subscription ${subscription.id} has no companyId metadata`);
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id;
  const mapped = priceId ? planAndCycleForPrice(priceId) : null;

  const status = subscription.status === "active" || subscription.status === "trialing" ? "active" : "suspended";

  const updates = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end
      ? Timestamp.fromMillis(subscription.current_period_end * 1000)
      : null,
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (mapped) {
    updates.plan = mapped.plan;
    updates.billingCycle = mapped.billingCycle;
  }
  if (subscription.status === "canceled") {
    updates.status = "suspended";
  }

  await db.collection("companies").doc(companyId).update(updates);
  logger.info(`Synced subscription ${subscription.id} to company ${companyId} (${subscription.status})`);
}

async function recordInvoice(invoice) {
  const companyId = invoice.subscription_details?.metadata?.companyId ?? invoice.metadata?.companyId;
  if (!companyId) return;

  await db
    .collection("companies")
    .doc(companyId)
    .collection("billingInvoices")
    .doc(invoice.id)
    .set({
      stripeInvoiceId: invoice.id,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
      periodStart: invoice.period_start ? Timestamp.fromMillis(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? Timestamp.fromMillis(invoice.period_end * 1000) : null,
      createdAt: FieldValue.serverTimestamp(),
    });
}

/**
 * A card saved through the add-card window (Checkout setup mode) becomes the
 * customer's default for invoices — and the active subscription's, if any —
 * so the next renewal charges it.
 */
async function makeSetupCardDefault(session) {
  if (!session.setup_intent || !session.customer) return;
  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent);
  const paymentMethod = typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;
  if (!paymentMethod) return;
  await stripe.customers.update(session.customer, { invoice_settings: { default_payment_method: paymentMethod } });

  const companyId = session.metadata?.companyId;
  if (!companyId) return;
  const company = (await db.collection("companies").doc(companyId).get()).data();
  if (company?.stripeSubscriptionId && company.subscriptionStatus !== "canceled") {
    try {
      await stripe.subscriptions.update(company.stripeSubscriptionId, { default_payment_method: paymentMethod });
    } catch (err) {
      logger.warn(`Could not set default card on subscription ${company.stripeSubscriptionId}`, err);
    }
  }
}

/**
 * A paid top-up (Checkout payment mode) is credited to the customer's Stripe
 * balance, which Stripe applies automatically to upcoming invoices. The
 * session ID is the idempotency key so a redelivered webhook never credits
 * twice.
 */
async function creditTopUp(session) {
  if (session.payment_status !== "paid" || !session.customer) return;
  const amount = session.amount_total ?? Number(session.metadata?.amountCents ?? 0);
  if (!amount) return;
  await getStripe().customers.createBalanceTransaction(
    session.customer,
    {
      amount: -amount,
      currency: session.currency ?? "usd",
      description: "Account credit top-up",
      metadata: { checkoutSessionId: session.id, companyId: session.metadata?.companyId ?? "" },
    },
    { idempotencyKey: `topup-credit-${session.id}` },
  );
  logger.info(`Credited ${amount} ${session.currency} top-up to customer ${session.customer}`);
}

/**
 * Stripe webhook endpoint. Configure this function's URL as the endpoint in
 * the Stripe Dashboard, subscribed to: checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted,
 * invoice.paid — and, optionally, payment_intent.succeeded as a safety net
 * for in-page account credit top-ups (normally credited by confirmTopUp). This is the only path (besides direct Firestore admin
 * access) allowed to write plan/subscription fields on a company doc —
 * firestore.rules blocks clients from writing them directly.
 */
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const signature = req.headers["stripe-signature"];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value());
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "setup") {
          await makeSetupCardDefault(session);
        } else if (session.mode === "payment" && session.metadata?.type === "topup") {
          await creditTopUp(session);
        } else if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription);
          await syncSubscriptionToCompany(subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await syncSubscriptionToCompany(event.data.object);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const companyId = subscription.metadata?.companyId;
        if (companyId) {
          await db.collection("companies").doc(companyId).update({
            subscriptionStatus: "canceled",
            status: "suspended",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        // In-page top-ups: normally credited by confirmTopUp; this is the
        // safety net (same idempotency key) if the browser closed first.
        const intent = event.data.object;
        if (intent.metadata?.type === "topup" && intent.customer) {
          await creditTopUpPayment(getStripe(), intent);
        }
        break;
      }
      case "invoice.paid": {
        await recordInvoice(event.data.object);
        break;
      }
      default:
        break;
    }

    res.status(200).send({ received: true });
  } catch (err) {
    logger.error(`Stripe webhook handler failed for event ${event.type}`, err);
    res.status(500).send("Webhook handler failed");
  }
});
