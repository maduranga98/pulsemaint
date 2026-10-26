const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore("default");

// Plan prices in USD — keep in sync with PLANS in src/pages/billing/BillingPage.tsx.
// Used only for the platform console's revenue estimates.
const PLAN_PRICES = {
  starter: { monthly: 29, yearly: 278 },
  workshop: { monthly: 79, yearly: 758 },
  factory: { monthly: 199, yearly: 1910 },
};

/** Lumora Ventures staff alerts (daily billing digest, new support requests). */
const PLATFORM_ALERT_EMAIL = process.env.PLATFORM_ALERT_EMAIL || "info@lumoraventures.com";

/**
 * Emails allowed to activate superadmin access on their own account
 * (bootstrap). Comma-separated in functions/.env PLATFORM_SUPERADMIN_EMAILS.
 * Further superadmins can then be granted from the console.
 */
function bootstrapSuperadminEmails() {
  return (process.env.PLATFORM_SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Superadmin = Firebase Auth custom claim `superadmin: true` (Lumora Ventures staff). */
function requireSuperadmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");
  if (request.auth.token?.superadmin !== true) {
    throw new HttpsError("permission-denied", "Superadmin access required");
  }
  return { uid: request.auth.uid, email: request.auth.token.email ?? null };
}

/**
 * Sales access = superadmin OR a sales manager (Firebase Auth custom claim
 * `salesManager: true`, granted by a superadmin through platformCreateSalesManager).
 * Sales managers only reach the sales part of the console.
 */
function requireSalesAccess(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");
  const t = request.auth.token || {};
  if (t.superadmin !== true && t.salesManager !== true) {
    throw new HttpsError("permission-denied", "Sales access required");
  }
  return { uid: request.auth.uid, email: t.email ?? null, superadmin: t.superadmin === true };
}

/** Every superadmin action is written to platformAuditLog. */
async function audit(actor, action, details) {
  await db.collection("platformAuditLog").add({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action,
    ...details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function monthlyValue(company) {
  const prices = PLAN_PRICES[company.plan];
  if (!prices || company.status !== "active" || !company.stripeSubscriptionId) return 0;
  return company.billingCycle === "yearly" ? prices.yearly / 12 : prices.monthly;
}

function toMillis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

module.exports = {
  db,
  PLAN_PRICES,
  PLATFORM_ALERT_EMAIL,
  bootstrapSuperadminEmails,
  requireSuperadmin,
  requireSalesAccess,
  audit,
  monthlyValue,
  toMillis,
};
