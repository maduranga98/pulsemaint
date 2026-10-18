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

// AI credits per calendar month (1 AI request = 1 credit); null = unlimited.
// Mirrors aiCreditsPerMonth in src/lib/planLimits.ts — keep the two in sync.
const AI_CREDITS = {starter: 20, workshop: 150, factory: 800, enterprise: null};
const ENTERPRISE_TIER_AI_CREDITS = {enterprise1: 2000, enterprise2: 5000, enterprise3: 15000, unlimited: null};

/**
 * The monthly AI credits a company may use: its plan (Starter while on a
 * free trial), the Enterprise tier, then a per-company override.
 */
function aiCreditsLimit(company) {
  if (!company) return AI_CREDITS.starter;
  const ov = company.limitOverrides && company.limitOverrides.aiCreditsPerMonth;
  if (ov === null) return null;
  if (Number.isInteger(ov) && ov >= 0) return ov;
  const onTrial = company.status === "trial" && !company.stripeSubscriptionId && company.planSetBy !== "platform";
  const plan = onTrial ? "starter" : company.plan;
  if (plan === "enterprise" && company.enterpriseTier in ENTERPRISE_TIER_AI_CREDITS) return ENTERPRISE_TIER_AI_CREDITS[company.enterpriseTier];
  return plan in AI_CREDITS ? AI_CREDITS[plan] : AI_CREDITS.starter;
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

/** The AI credits limit for a company id (starter limit when it can't be read). */
async function companyAiCredits(companyId) {
  if (!companyId) return AI_CREDITS.starter;
  try {
    const snap = await getFirestore("default").collection("companies").doc(companyId).get();
    return aiCreditsLimit(snap.exists ? snap.data() : null);
  } catch (err) {
    return AI_CREDITS.starter;
  }
}

module.exports = {featureAvailable, companyHasFeature, aiCreditsLimit, companyAiCredits};
