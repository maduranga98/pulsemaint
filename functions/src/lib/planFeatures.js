/**
 * Server-side mirror of the plan feature matrix in src/lib/planLimits.ts, for
 * features that run in Cloud Functions (automatic PO emails, low-stock
 * alerts). Keep the two in sync.
 */

const {getFirestore} = require("firebase-admin/firestore");

// Only the features enforced in Cloud Functions: PO emails / low-stock alerts,
// AI suggestions (claudeJson), report exports (generateReport) and scheduled
// reports (generateScheduledReport, part of advanced analytics).
const FEATURES = {
  starter: {autoPOEmail: false, qrLowStockAlerts: false, aiAssist: true, analyticsReports: true, advancedAnalytics: false},
  workshop: {autoPOEmail: true, qrLowStockAlerts: true, aiAssist: true, analyticsReports: true, advancedAnalytics: false},
  factory: {autoPOEmail: true, qrLowStockAlerts: true, aiAssist: true, analyticsReports: true, advancedAnalytics: true},
  enterprise: {autoPOEmail: true, qrLowStockAlerts: true, aiAssist: true, analyticsReports: true, advancedAnalytics: true},
};

// AI credits per month per plan (null = unlimited) — mirrors PLAN_LIMITS in
// src/lib/planLimits.ts. Keep the two in sync.
const AI_CREDITS_PER_MONTH = {starter: 20, workshop: 150, factory: 800, enterprise: null};
// Enterprise sized tiers (companies.enterpriseTier).
const AI_CREDITS_BY_TIER = {enterprise1: 1500, enterprise2: 3750, enterprise3: 7500, unlimited: null};

/**
 * Monthly AI credit allowance of a company: plan, narrowed to its Enterprise
 * tier, then a Lumora override (limitOverrides.aiCreditsPerMonth). null = unlimited.
 */
function aiCreditLimit(company) {
  if (!company) return AI_CREDITS_PER_MONTH.starter;
  const o = company.limitOverrides && company.limitOverrides.aiCreditsPerMonth;
  if (o === null) return null;
  if (typeof o === "number" && Number.isFinite(o) && o >= 0) return o;
  if (company.plan === "enterprise" && company.enterpriseTier in AI_CREDITS_BY_TIER) {
    return AI_CREDITS_BY_TIER[company.enterpriseTier];
  }
  return company.plan in AI_CREDITS_PER_MONTH ? AI_CREDITS_PER_MONTH[company.plan] : AI_CREDITS_PER_MONTH.starter;
}

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

module.exports = {featureAvailable, companyHasFeature, aiCreditLimit};
