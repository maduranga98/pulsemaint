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

/**
 * Returns the company's Stripe customer ID, creating the customer on first
 * use — so cards and credit can be added before any plan is subscribed.
 */
async function ensureStripeCustomer({ companyId, companyRef, company }, email) {
  if (company.stripeCustomerId) return company.stripeCustomerId;
  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    name: company.name,
    metadata: { companyId },
  });
  await companyRef.update({ stripeCustomerId: customer.id, updatedAt: FieldValue.serverTimestamp() });
  return customer.id;
}

module.exports = { requireBillingAdmin, ensureStripeCustomer };
