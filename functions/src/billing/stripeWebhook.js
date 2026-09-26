const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey, stripeWebhookSecret, planAndCycleForPrice } = require("./stripeClient");

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
 * Stripe webhook endpoint. Configure this function's URL as the endpoint in
 * the Stripe Dashboard, subscribed to: checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted,
 * invoice.paid. checkout.session.completed also covers any legacy add-card
 * Checkout (setup mode) session. This is the only path (besides direct Firestore admin
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
