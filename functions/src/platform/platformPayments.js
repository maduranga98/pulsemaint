const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey, firmicorePlanOfInvoice } = require("../billing/stripeClient");
const { stripeErrorMessage } = require("../billing/billingAccess");
const { brandedEmail, sendEmail, platformSmtpPassword } = require("../lib/mailer");
const { db, PLATFORM_ALERT_EMAIL, requireSuperadmin, audit, toMillis } = require("./platformAccess");

const DAY = 86_400_000;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
const APP_URL = "https://app.firmicore.com";

/**
 * FirmiCore CMMS payments received — paid invoices that bill a FirmiCore plan
 * price. Everything else on the shared Stripe account (other Lumora Ventures
 * products, unpaid or void invoices) is left out. Returns up to 1,000 of
 * the most recent, each tagged with its plan and monthly/yearly cycle so the
 * console can total and filter them.
 */
exports.platformListPayments = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  requireSuperadmin(request);
  const companies = await db.collection("companies").get();
  const byCustomer = new Map();
  const byId = new Map();
  companies.forEach((d) => {
    const info = { id: d.id, name: d.get("name") ?? "(unnamed)" };
    byId.set(d.id, info);
    const cus = d.get("stripeCustomerId");
    if (cus) byCustomer.set(cus, info);
  });
  try {
    const payments = [];
    let scanned = 0;
    for await (const i of getStripe().invoices.list({ limit: 100, status: "paid" })) {
      if (++scanned > 5000 || payments.length >= 1000) break;
      if (!(i.amount_paid > 0)) continue;
      const plan = firmicorePlanOfInvoice(i);
      if (!plan) continue;
      const customer = typeof i.customer === "string" ? i.customer : i.customer?.id;
      const metaCompanyId = i.subscription_details?.metadata?.companyId ?? i.metadata?.companyId ?? null;
      const company = byCustomer.get(customer) ?? (metaCompanyId ? byId.get(metaCompanyId) : null) ?? null;
      payments.push({
        id: i.id,
        number: i.number ?? null,
        companyId: company?.id ?? metaCompanyId,
        companyName: company?.name ?? i.customer_name ?? i.customer_email ?? null,
        created: (i.status_transitions?.paid_at ?? i.created) * 1000,
        total: i.total,
        amountPaid: i.amount_paid,
        amountDue: i.amount_due,
        currency: i.currency,
        status: i.status,
        attemptCount: i.attempt_count ?? 0,
        nextAttempt: i.next_payment_attempt ? i.next_payment_attempt * 1000 : null,
        hostedInvoiceUrl: i.hosted_invoice_url ?? null,
        description: i.lines?.data?.[0]?.description ?? null,
        plan: plan.plan,
        billingCycle: plan.billingCycle,
      });
    }
    return { payments };
  } catch (err) {
    logger.error("platformListPayments failed", err);
    throw new HttpsError("internal", stripeErrorMessage(err, "Could not load payments"));
  }
});

/**
 * Companies that need a payment follow-up: failed/overdue renewals, trials
 * ending, renewals due in the next 7 days, and cancellations taking effect.
 */
async function computeReminders() {
  const now = Date.now();
  const snap = await db.collection("companies").get();
  const items = [];
  snap.forEach((d) => {
    const c = d.data();
    // Registrations not approved yet (or rejected) have no trial running to chase.
    if (c.approvalStatus === "pending" || c.approvalStatus === "rejected") return;
    const base = { companyId: d.id, companyName: c.name ?? "(unnamed)", plan: c.plan ?? "starter", billingCycle: c.billingCycle ?? "monthly", lastReminderAt: toMillis(c.lastPaymentReminderAt) };
    const periodEnd = toMillis(c.currentPeriodEnd);
    const trialEnd = toMillis(c.trialEndsAt);
    if (["past_due", "unpaid"].includes(c.subscriptionStatus)) {
      items.push({ ...base, kind: "paymentFailed", severity: "high", dueAt: periodEnd });
    } else if (c.stripeSubscriptionId && c.cancelAtPeriodEnd && periodEnd && periodEnd > now) {
      items.push({ ...base, kind: "cancelling", severity: "medium", dueAt: periodEnd });
    } else if (c.stripeSubscriptionId && c.subscriptionStatus !== "canceled" && periodEnd && periodEnd > now && periodEnd - now <= 7 * DAY) {
      items.push({ ...base, kind: "renewalDue", severity: "low", dueAt: periodEnd });
    }
    if ((c.status ?? "trial") === "trial" && trialEnd && trialEnd - now <= 7 * DAY) {
      items.push({ ...base, kind: trialEnd < now ? "trialExpired" : "trialEnding", severity: trialEnd < now ? "high" : "medium", dueAt: trialEnd });
    }
  });
  const rank = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.dueAt ?? 0) - (b.dueAt ?? 0));
  return items;
}

exports.platformListReminders = onCall(async (request) => {
  requireSuperadmin(request);
  return { reminders: await computeReminders() };
});

const REMINDER_COPY = {
  paymentFailed: {
    subject: "Action needed: your FirmiCore payment did not go through",
    body: (d) => `<p>We could not collect the latest payment for <strong>${d.company}</strong>'s FirmiCore ${d.plan} subscription.</p>
<p>Please update the card on the <a href="${APP_URL}/app/billing">Billing &amp; Plan</a> page so your team keeps access. If the payment stays unpaid, access for all users will be suspended — your data is kept safe and is not deleted.</p>`,
  },
  renewalDue: {
    subject: "Your FirmiCore subscription renews soon",
    body: (d) => `<p>This is a reminder that <strong>${d.company}</strong>'s FirmiCore ${d.plan} (${d.cycle}) subscription renews automatically on <strong>${d.date}</strong>, and the card on file will be charged.</p>
<p>You can review your plan or card on the <a href="${APP_URL}/app/billing">Billing &amp; Plan</a> page.</p>`,
  },
  trialEnding: {
    subject: "Your FirmiCore trial is ending",
    body: (d) => `<p><strong>${d.company}</strong>'s FirmiCore trial ends on <strong>${d.date}</strong>.</p>
<p>Choose a plan on the <a href="${APP_URL}/app/billing">Billing &amp; Plan</a> page to keep using FirmiCore without interruption.</p>`,
  },
  trialExpired: {
    subject: "Your FirmiCore trial has ended",
    body: (d) => `<p><strong>${d.company}</strong>'s FirmiCore trial has ended.</p>
<p>Choose a plan on the <a href="${APP_URL}/app/billing">Billing &amp; Plan</a> page to continue. Your data is kept safe.</p>`,
  },
  cancelling: {
    subject: "Your FirmiCore subscription is ending",
    body: (d) => `<p><strong>${d.company}</strong>'s FirmiCore subscription is cancelled and access for all users ends on <strong>${d.date}</strong>. Your data is not deleted.</p>
<p>To keep your team's access, resume the subscription on the <a href="${APP_URL}/app/billing">Billing &amp; Plan</a> page.</p>`,
  },
};

/** Emails the company admin a payment reminder (sent by Lumora staff from the console). */
exports.platformSendPaymentReminder = onCall({ secrets: [platformSmtpPassword] }, async (request) => {
  const actor = requireSuperadmin(request);
  const { companyId, kind } = request.data ?? {};
  const copy = REMINDER_COPY[kind];
  if (!copy) throw new HttpsError("invalid-argument", "Unknown reminder type");
  const ref = db.collection("companies").doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Company not found");
  const c = snap.data();
  const admin = c.adminUserId ? await db.doc(`companies/${companyId}/users/${c.adminUserId}`).get() : null;
  const to = admin?.get("email") || c.email;
  if (!to) throw new HttpsError("failed-precondition", "This company has no admin email address");
  const dueAt = kind.startsWith("trial") ? toMillis(c.trialEndsAt) : toMillis(c.currentPeriodEnd);
  const details = {
    company: esc(c.name ?? "your company"),
    plan: esc(c.plan ?? ""),
    cycle: c.billingCycle === "yearly" ? "yearly" : "monthly",
    date: dueAt ? new Date(dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "soon",
  };
  const html = brandedEmail(`${copy.body(details)}<p style="color:#64748b;font-size:13px">Questions? Reply to this email or contact ${PLATFORM_ALERT_EMAIL}.</p>`);
  await sendEmail({ to, subject: copy.subject, html, replyTo: PLATFORM_ALERT_EMAIL });
  await ref.update({ lastPaymentReminderAt: FieldValue.serverTimestamp(), lastPaymentReminderKind: kind });
  await audit(actor, "company.paymentReminder", { companyId, companyName: c.name ?? null, kind, to });
  return { ok: true, to };
});

/** Daily digest to Lumora Ventures of every payment follow-up that is due. */
exports.platformDailyBillingDigest = onSchedule(
  { schedule: "30 8 * * *", timeZone: "Asia/Colombo", secrets: [platformSmtpPassword] },
  async () => {
    const reminders = await computeReminders();
    if (!reminders.length) return;
    const label = { paymentFailed: "Payment failed", cancelling: "Cancelling", renewalDue: "Renewal due", trialEnding: "Trial ending", trialExpired: "Trial expired" };
    const rows = reminders.map((r) => `<tr><td style="padding:4px 8px">${esc(r.companyName)}</td><td style="padding:4px 8px">${label[r.kind]}</td><td style="padding:4px 8px">${r.plan} · ${r.billingCycle}</td><td style="padding:4px 8px">${r.dueAt ? new Date(r.dueAt).toISOString().slice(0, 10) : ""}</td></tr>`).join("");
    const html = brandedEmail(`<p>${reminders.length} compan${reminders.length === 1 ? "y needs" : "ies need"} a payment follow-up today.</p>
<table style="border-collapse:collapse;font-size:13px">${rows}</table>
<p><a href="${APP_URL}/platform/reminders">Open the platform console</a></p>`);
    await sendEmail({ to: PLATFORM_ALERT_EMAIL, subject: `FirmiCore billing follow-ups: ${reminders.length}`, html });
    logger.info(`platformDailyBillingDigest sent ${reminders.length} items`);
  },
);
