const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey, priceIdFor } = require("./stripeClient");
const { ensureStripeCustomer, stripeErrorMessage } = require("./billingAccess");

const db = getFirestore("default");

/**
 * Creates a Stripe Checkout session for a plan upgrade/downgrade and returns
 * its hosted URL. Only company admins may change the plan (enforced here,
 * not just in the UI, since firestore.rules blocks clients from writing
 * plan/subscription fields directly — Stripe + the webhook are now the only
 * path that changes them).
 */
exports.createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");

  const { plan, billingCycle, successUrl, cancelUrl } = request.data ?? {};
  if (!["starter", "workshop", "factory"].includes(plan)) {
    throw new HttpsError("invalid-argument", "Unknown plan");
  }
  if (!["monthly", "yearly"].includes(billingCycle)) {
    throw new HttpsError("invalid-argument", "Unknown billing cycle");
  }
  if (!successUrl || !cancelUrl) {
    throw new HttpsError("invalid-argument", "successUrl and cancelUrl are required");
  }

  const priceId = priceIdFor(plan, billingCycle);
  if (!priceId) {
    throw new HttpsError("failed-precondition", `No Stripe price configured for ${plan}/${billingCycle}`);
  }

  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userData = userDoc.data();
  if (!userData?.companyId) throw new HttpsError("failed-precondition", "No company on user profile");
  if (userData.role !== "admin") throw new HttpsError("permission-denied", "Only admins can change the plan");

  const companyRef = db.collection("companies").doc(userData.companyId);
  const companyDoc = await companyRef.get();
  if (!companyDoc.exists) throw new HttpsError("not-found", "Company not found");
  const company = companyDoc.data();

  try {
    const stripe = getStripe();

    const customerId = await ensureStripeCustomer(
      { companyId: userData.companyId, companyRef, company },
      request.auth.token?.email,
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userData.companyId,
      subscription_data: {
        metadata: { companyId: userData.companyId, plan, billingCycle },
      },
      metadata: { companyId: userData.companyId, plan, billingCycle },
    });

    return { url: session.url };
  } catch (err) {
    logger.error("createCheckoutSession failed", err);
    throw new HttpsError("internal", stripeErrorMessage(err, "Failed to create checkout session"));
  }
});
