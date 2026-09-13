const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey } = require("./stripeClient");

const db = getFirestore("default");

/**
 * Creates a Stripe Billing Portal session so admins can manage payment
 * methods, view invoices, and cancel — without FirmiCore storing any card
 * data itself.
 */
exports.createPortalSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");

  const { returnUrl } = request.data ?? {};
  if (!returnUrl) throw new HttpsError("invalid-argument", "returnUrl is required");

  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userData = userDoc.data();
  if (!userData?.companyId) throw new HttpsError("failed-precondition", "No company on user profile");
  if (userData.role !== "admin") throw new HttpsError("permission-denied", "Only admins can manage billing");

  const companyDoc = await db.collection("companies").doc(userData.companyId).get();
  const company = companyDoc.data();
  if (!company?.stripeCustomerId) {
    throw new HttpsError("failed-precondition", "No Stripe customer yet — subscribe to a plan first");
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  } catch (err) {
    logger.error("createPortalSession failed", err);
    throw new HttpsError("internal", "Failed to create billing portal session");
  }
});
