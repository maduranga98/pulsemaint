/**
 * Server-side mirror of the plan feature matrix in src/lib/planLimits.ts, for
 * features that run in Cloud Functions (automatic PO emails, low-stock
 * alerts). Keep the two in sync.
 */

const {getFirestore} = require("firebase-admin/firestore");

const FEATURES = {
  starter: {autoPOEmail: false, qrLowStockAlerts: false},
  workshop: {autoPOEmail: true, qrLowStockAlerts: true},
  factory: {autoPOEmail: true, qrLowStockAlerts: true},
  enterprise: {autoPOEmail: true, qrLowStockAlerts: true},
};

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return typeof ts === "number" ? ts : null;
}

/** Pure check on a company document's data. */
function featureAvailable(company, feature, now = Date.now()) {
  if (!company) return false;
  const onTrial = company.status === "trial" && !company.stripeSubscriptionId && company.planSetBy !== "platform";
  if (company.status === "trial") {
    const end = toMillis(company.trialEndsAt);
    const expired = onTrial && end !== null && end <= now;
    if (!expired) return true; // a running trial unlocks every feature
  }
  if (company.status === "suspended") return false;
  return (FEATURES[company.plan] || FEATURES.starter)[feature] === true;
}

async function companyHasFeature(companyId, feature) {
  if (!companyId) return false;
  try {
    const snap = await getFirestore("default").collection("companies").doc(companyId).get();
    return featureAvailable(snap.exists ? snap.data() : null, feature);
  } catch (err) {
    // Don't silently drop supplier/stock mail because of a transient read error.
    return true;
  }
}

module.exports = {featureAvailable, companyHasFeature};
