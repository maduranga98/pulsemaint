const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey } = require("./stripeClient");
const { brandedEmail, sendEmail, platformSmtpPassword } = require("../lib/mailer");

const db = getFirestore("default");
const PLATFORM_ALERT_EMAIL = process.env.PLATFORM_ALERT_EMAIL || "info@lumoraventures.com";
const APP_URL = "https://app.firmicore.com";

/** Reason codes — keep in sync with CANCELLATION_REASONS in src/lib/cancellation.ts. */
const CANCELLATION_REASONS = [
  "too_expensive", "missing_features", "not_using", "switching", "technical_issues", "hard_to_use", "business_closed", "temporary", "other",
];
const REASON_LABEL = {
  too_expensive: "Too expensive", missing_features: "Missing features we need", not_using: "Not using it enough",
  switching: "Switching to another system", technical_issues: "Bugs or technical problems", hard_to_use: "Too hard to use",
  business_closed: "Business closed or merged", temporary: "Only needed it temporarily", other: "Other",
  stripe_portal: "Cancelled in the Stripe billing portal", platform: "Cancelled by Lumora",
};
const KIND_LABEL = { cancel_subscription: "Subscription cancellation", leave_system: "Request to leave FirmiCore" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);

/** Stripe portal feedback codes → our reasons. */
const STRIPE_FEEDBACK = {
  too_expensive: "too_expensive", missing_features: "missing_features", switched_service: "switching", unused: "not_using",
  customer_service: "other", too_complex: "hard_to_use", low_quality: "technical_issues", other: "other",
};

/**
 * Stores a cancellation / leave request in platformCancellations (read by the
 * Lumora console's Cancellations tab) and emails Lumora. Returns the doc id.
 */
async function recordCancellation({ companyId, company, kind, reason, details, source, actor, reasonPending = false }) {
  const ref = await db.collection("platformCancellations").add({
    companyId,
    companyName: company?.name ?? null,
    kind,
    reason: reason ?? null,
    details: details ?? "",
    source,
    reasonPending,
    plan: company?.plan ?? null,
    billingCycle: company?.billingCycle ?? null,
    hadSubscription: !!company?.stripeSubscriptionId,
    endsAt: company?.currentPeriodEnd ?? null,
    requestedByUid: actor?.uid ?? null,
    requestedByEmail: actor?.email ?? null,
    requestedByName: actor?.name ?? null,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  await emailLumora(ref.id).catch((err) => logger.error("cancellation email failed", err));
  return ref.id;
}

async function emailLumora(id) {
  const snap = await db.collection("platformCancellations").doc(id).get();
  const r = snap.data();
  if (!r) return;
  const rows = [
    ["Company", r.companyName ?? r.companyId],
    ["Type", KIND_LABEL[r.kind] ?? r.kind],
    ["Reason", r.reasonPending ? "(waiting for the admin to choose one)" : REASON_LABEL[r.reason] ?? r.reason],
    ["Details", r.details],
    ["Plan", r.plan ? `${r.plan} · ${r.billingCycle ?? ""}` : ""],
    ["Requested by", [r.requestedByName, r.requestedByEmail].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v);
  const html = brandedEmail(`<p><strong>${esc(KIND_LABEL[r.kind] ?? r.kind)}</strong> from <strong>${esc(r.companyName ?? r.companyId)}</strong>.</p>
<table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<p><a href="${APP_URL}/platform/cancellations">Open Cancellations in the platform console</a></p>`);
  await sendEmail({ to: PLATFORM_ALERT_EMAIL, subject: `FirmiCore: ${KIND_LABEL[r.kind] ?? r.kind} — ${r.companyName ?? r.companyId}`, html });
}

/**
 * Webhook hook: the subscription was set to cancel (or cancelled) outside the
 * app — normally the Stripe billing portal. Records it with Stripe's feedback
 * if the customer gave one; otherwise flags the company so its admin must
 * pick a reason on the Billing page.
 */
async function recordPortalCancellation(companyId, company, subscription) {
  const feedback = subscription.cancellation_details?.feedback ?? null;
  const comment = subscription.cancellation_details?.comment ?? "";
  const reason = feedback ? STRIPE_FEEDBACK[feedback] ?? "other" : null;
  const id = await recordCancellation({
    companyId, company, kind: "cancel_subscription", reason, details: comment, source: "stripe_portal", reasonPending: !reason,
  });
  if (!reason) await db.collection("companies").doc(companyId).update({ cancellationReasonPendingId: id });
}

/**
 * Company admin: cancel the subscription (at the end of the paid period) or
 * ask to leave FirmiCore completely — a reason is required for both. Also
 * answers a pending reason for a cancellation made in the Stripe portal.
 *   data: { kind: 'cancel_subscription' | 'leave_system' | 'reason', reason, details }
 */
exports.requestCancellation = onCall({ secrets: [stripeSecretKey, platformSmtpPassword] }, async (request) => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("unauthenticated", "Sign in first");
  const { kind, reason } = request.data ?? {};
  const details = String(request.data?.details ?? "").trim().slice(0, 2000);
  if (!["cancel_subscription", "leave_system", "reason"].includes(kind)) throw new HttpsError("invalid-argument", "Unknown request");
  if (!CANCELLATION_REASONS.includes(reason)) throw new HttpsError("invalid-argument", "Choose a reason");
  if (reason === "other" && !details) throw new HttpsError("invalid-argument", "Tell us the reason");

  const user = await db.collection("users").doc(request.auth.uid).get();
  const companyId = user.get("companyId");
  if (!companyId) throw new HttpsError("failed-precondition", "No company on your profile");
  if (user.get("role") !== "admin") throw new HttpsError("permission-denied", "Only company admins can do this");
  const companyRef = db.collection("companies").doc(companyId);
  const company = (await companyRef.get()).data() ?? {};
  const profile = await companyRef.collection("users").doc(request.auth.uid).get();
  const actor = { uid: request.auth.uid, email: request.auth.token.email ?? profile.get("email") ?? null, name: profile.get("fullName") ?? null };

  if (kind === "reason") {
    const pendingId = company.cancellationReasonPendingId;
    if (!pendingId) return { ok: true };
    await db.collection("platformCancellations").doc(pendingId).update({
      reason, details, reasonPending: false, requestedByUid: actor.uid, requestedByEmail: actor.email, requestedByName: actor.name,
      reasonGivenAt: FieldValue.serverTimestamp(),
    });
    await companyRef.update({ cancellationReasonPendingId: FieldValue.delete() });
    await emailLumora(pendingId).catch((err) => logger.error("cancellation email failed", err));
    return { ok: true };
  }

  const activeSub = company.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(company.subscriptionStatus);
  if (kind === "cancel_subscription" && !activeSub) throw new HttpsError("failed-precondition", "There is no active subscription to cancel");
  if (kind === "leave_system" && company.leaveRequestedAt) throw new HttpsError("already-exists", "You have already asked to leave — Lumora will contact you");

  // Cancel at the period end first, so the webhook sees cancelAtPeriodEnd already set and doesn't record it twice.
  let endsAt = company.currentPeriodEnd ?? null;
  if (activeSub && !company.cancelAtPeriodEnd) {
    const sub = await getStripe().subscriptions.update(company.stripeSubscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: { comment: `${reason}${details ? `: ${details}` : ""}`.slice(0, 500) },
    });
    const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    if (periodEnd) endsAt = Timestamp.fromMillis(periodEnd * 1000);
    await companyRef.update({ cancelAtPeriodEnd: true, ...(endsAt ? { currentPeriodEnd: endsAt } : {}) });
  }
  if (kind === "leave_system") await companyRef.update({ leaveRequestedAt: FieldValue.serverTimestamp() });

  await recordCancellation({
    companyId, company: { ...company, currentPeriodEnd: endsAt }, kind, reason, details, source: "app", actor,
  });
  return { ok: true, endsAt: endsAt?.toMillis?.() ?? null };
});

module.exports.recordCancellation = recordCancellation;
module.exports.recordPortalCancellation = recordPortalCancellation;
module.exports.CANCELLATION_REASONS = CANCELLATION_REASONS;
