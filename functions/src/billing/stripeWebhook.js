const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey, stripeWebhookSecret, planAndCycleForPrice, isFirmicoreInvoice, firmicorePlanOfInvoice } = require("./stripeClient");
const { brandedEmail, sendEmail, platformSmtpPassword } = require("../lib/mailer");

const APP_URL = "https://app.firmicore.com";
const PLAN_NAMES = { starter: "Basic", workshop: "Workshop", factory: "Factory Pro", enterprise: "Enterprise" };

/** End of the period an invoice pays for = the next automatic renewal date. */
function invoicePaidThrough(invoice) {
  const ends = (invoice?.lines?.data ?? []).map((l) => l?.period?.end).filter((n) => typeof n === "number");
  const end = ends.length ? Math.max(...ends) : invoice?.period_end;
  return end ? end * 1000 : null;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
}

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

  // Access follows the subscription for every user of the company:
  // - active / trialing, and past_due while Stripe retries the renewal → active
  // - canceled / unpaid / incomplete_expired / paused → suspended (all roles
  //   lose access; data is kept). A subscription cancelled "at period end"
  //   stays active until that date, then Stripe sends subscription.deleted.
  // - incomplete (first payment still being confirmed) → leave access as is.
  const ACTIVE = ["active", "trialing", "past_due"];
  const SUSPENDED = ["canceled", "unpaid", "incomplete_expired", "paused"];
  const periodEnd = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;

  const updates = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? Timestamp.fromMillis(periodEnd * 1000) : null,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (ACTIVE.includes(subscription.status)) updates.status = "active";
  if (SUSPENDED.includes(subscription.status)) updates.status = "suspended";
  if (mapped) {
    updates.plan = mapped.plan;
    updates.billingCycle = mapped.billingCycle;
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
      plan: firmicorePlanOfInvoice(invoice)?.plan ?? null,
      billingCycle: firmicorePlanOfInvoice(invoice)?.billingCycle ?? null,
      number: invoice.number ?? null,
      paidThrough: invoicePaidThrough(invoice) ? Timestamp.fromMillis(invoicePaidThrough(invoice)) : null,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Automatic charge succeeded → email every admin of the company a receipt
 * with the plan, amount and the next automatic renewal date. Sent once per
 * invoice (Stripe retries webhooks), recorded as receiptEmailedAt.
 */
async function emailPaymentReceipt(invoice) {
  const companyId = invoice.subscription_details?.metadata?.companyId ?? invoice.metadata?.companyId;
  if (!companyId || !(invoice.amount_paid > 0)) return;
  const invoiceRef = db.collection("companies").doc(companyId).collection("billingInvoices").doc(invoice.id);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(invoiceRef);
    if (snap.get("receiptEmailedAt")) return false;
    tx.set(invoiceRef, { receiptEmailedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!claimed) return;

  const [company, admins] = await Promise.all([
    db.collection("companies").doc(companyId).get(),
    db.collection("companies").doc(companyId).collection("users").where("role", "==", "admin").get(),
  ]);
  const to = [...new Set(admins.docs
    .filter((d) => d.get("status") !== "inactive")
    .map((d) => d.get("email"))
    .filter((e) => typeof e === "string" && e.includes("@")))];
  if (invoice.customer_email && !to.length) to.push(invoice.customer_email);
  if (!to.length) return;

  const plan = firmicorePlanOfInvoice(invoice);
  const planLabel = plan ? `${PLAN_NAMES[plan.plan] ?? plan.plan} (${plan.billingCycle})` : "FirmiCore subscription";
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: String(invoice.currency || "usd").toUpperCase() }).format(invoice.amount_paid / 100);
  const fmt = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const paidThrough = invoicePaidThrough(invoice);
  const companyName = company.get("name") ?? null;
  const html = brandedEmail(`<p>Thank you — we've received your FirmiCore payment${companyName ? ` for <strong>${escapeHtml(companyName)}</strong>` : ""}.</p>
<table style="border-collapse:collapse;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Plan</td><td><strong>${escapeHtml(planLabel)}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Amount charged</td><td><strong>${escapeHtml(amount)}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Charged on</td><td>${fmt(Date.now())}</td></tr>
${paidThrough ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Next automatic renewal</td><td><strong>${fmt(paidThrough)}</strong></td></tr>` : ""}
${invoice.number ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Invoice</td><td>${escapeHtml(invoice.number)}</td></tr>` : ""}
</table>
${invoice.hosted_invoice_url ? `<p><a href="${escapeHtml(invoice.hosted_invoice_url)}">View or download the invoice</a></p>` : ""}
<p style="color:#64748b;font-size:13px">Your subscription renews automatically on the date above using the card on file. You can change your plan or card any time on the <a href="${APP_URL}/app/billing">Billing &amp; Plan</a> page.</p>`, companyName);
  try {
    await sendEmail({ to: to.join(","), subject: `FirmiCore payment received — ${amount}`, html });
  } catch (err) {
    logger.error("payment receipt email failed", err);
    await invoiceRef.set({ receiptEmailedAt: FieldValue.delete() }, { merge: true }).catch(() => {});
  }
}

/** Payment received → notification for Lumora superadmins (platform console). */
async function notifyPaymentReceived(invoice) {
  const companyId = invoice.subscription_details?.metadata?.companyId ?? invoice.metadata?.companyId ?? null;
  let companyName = invoice.customer_name ?? invoice.customer_email ?? null;
  if (companyId) {
    const snap = await db.collection("companies").doc(companyId).get();
    if (snap.exists) companyName = snap.get("name") ?? companyName;
  }
  await db.collection("platformNotifications").doc(`payment_${invoice.id}`).set({
    type: "payment",
    invoiceId: invoice.id,
    companyId,
    companyName,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    read: false,
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
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret, platformSmtpPassword] }, async (req, res) => {
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
          // The paid period is over: suspend every user of the company. Data
          // is not touched, and a new subscription restores access.
          await db.collection("companies").doc(companyId).update({
            subscriptionStatus: "canceled",
            cancelAtPeriodEnd: false,
            status: "suspended",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        // The Stripe account also bills other Lumora products — only
        // FirmiCore plan invoices are recorded and announced.
        if (!isFirmicoreInvoice(invoice)) break;
        await recordInvoice(invoice);
        if (invoice.amount_paid > 0) {
          await notifyPaymentReceived(invoice);
          await emailPaymentReceipt(invoice);
        }
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
