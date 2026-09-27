const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStripe } = require("./stripeClient");

const db = getFirestore("default");

/**
 * Resolves the caller's company and enforces that only a company admin can
 * touch billing. Returns the company doc ref and data.
 */
async function requireBillingAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userData = userDoc.data();
  if (!userData?.companyId) throw new HttpsError("failed-precondition", "No company on user profile");
  if (userData.role !== "admin") throw new HttpsError("permission-denied", "Only admins can manage billing");

  const companyRef = db.collection("companies").doc(userData.companyId);
  const companyDoc = await companyRef.get();
  if (!companyDoc.exists) throw new HttpsError("not-found", "Company not found");
  return { companyId: userData.companyId, companyRef, company: companyDoc.data() };
}

/** True when Stripe says the object doesn't exist (e.g. an ID from the other test/live mode). */
function isMissingResource(err) {
  return err?.code === "resource_missing" || err?.statusCode === 404;
}

/**
 * Returns the company's Stripe customer ID, creating the customer on first
 * use — so cards can be added before any plan is subscribed. A stored ID
 * that the current Stripe key can't see (deleted, or created under the other
 * test/live mode) is replaced with a fresh customer rather than failing.
 */
async function ensureStripeCustomer(ctx, email) {
  const { companyId, companyRef, company } = ctx;
  const stripe = getStripe();
  if (company.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(company.stripeCustomerId);
      if (!existing.deleted) return company.stripeCustomerId;
    } catch (err) {
      if (!isMissingResource(err)) throw err;
    }
  }
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: company.name,
    metadata: { companyId },
  });
  await companyRef.update({ stripeCustomerId: customer.id, updatedAt: FieldValue.serverTimestamp() });
  ctx.company = { ...company, stripeCustomerId: customer.id };
  return customer.id;
}

/**
 * Records that the admin accepted the Terms of Service (auto-renewal,
 * company-wide charging, suspension on cancellation) when adding a card or
 * subscribing. The client only sends this after the Terms box is ticked.
 */
async function recordBillingTerms(companyRef, uid, termsVersion) {
  if (typeof termsVersion !== "string" || !/^\d{4}-\d{2}-\d{2}(\.\d+)?$/.test(termsVersion)) {
    throw new HttpsError("failed-precondition", "You must accept the Terms of Service first");
  }
  await companyRef.update({
    billingTermsVersion: termsVersion,
    billingTermsAcceptedAt: FieldValue.serverTimestamp(),
    billingTermsAcceptedBy: uid,
  });
}

/**
 * A billing error the admin can act on: Stripe's own message (e.g. an
 * invalid API key or a card decline) instead of a generic failure.
 */
function stripeErrorMessage(err, fallback) {
  // Never echo Stripe's auth error: it quotes part of the configured key.
  if (err?.type === "StripeAuthenticationError") {
    return `${fallback}: the STRIPE_SECRET_KEY secret is not a valid Stripe secret key (it must start with sk_test_ or sk_live_). Reset it with "firebase functions:secrets:set STRIPE_SECRET_KEY" and redeploy functions.`;
  }
  return err?.type && typeof err.message === "string" ? `${fallback}: ${err.message}` : fallback;
}

module.exports = { requireBillingAdmin, ensureStripeCustomer, isMissingResource, stripeErrorMessage, recordBillingTerms };
