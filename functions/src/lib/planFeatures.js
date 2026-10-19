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

// Count limits (null = unlimited). Mirror of PLAN_LIMITS / ENTERPRISE_TIER_LIMITS in
// src/lib/planLimits.ts — keep the two in sync (a unit test compares them).
const COUNT_LIMITS = {
  starter: {fullUsers: 3, lightUsers: 10, plants: 1, machines: 15, inventoryItems: 100, pmSchedules: 30},
  workshop: {fullUsers: 10, lightUsers: 50, plants: 1, machines: 75, inventoryItems: 2000, pmSchedules: 400},
  factory: {fullUsers: 40, lightUsers: 250, plants: 1, machines: 400, inventoryItems: 10000, pmSchedules: 3000},
  enterprise: {fullUsers: null, lightUsers: null, plants: null, machines: null, inventoryItems: null, pmSchedules: null},
};
const ENTERPRISE_TIER_COUNTS = {
  enterprise1: {fullUsers: 100, lightUsers: 500, plants: 5, machines: 300, inventoryItems: 1000, pmSchedules: 300},
  enterprise2: {fullUsers: 250, lightUsers: 1250, plants: 10, machines: 1000, inventoryItems: 5000, pmSchedules: 1000},
  enterprise3: {fullUsers: 500, lightUsers: 2500, plants: 25, machines: 3000, inventoryItems: 20000, pmSchedules: 3000},
  unlimited: {fullUsers: null, lightUsers: null, plants: null, machines: null, inventoryItems: null, pmSchedules: null},
};

/**
 * One count limit for a company (key: fullUsers, lightUsers, plants, machines, inventoryItems, pmSchedules):
 * the plan (Starter while on a free trial), the Enterprise tier, then a per-company override.
 * Returns null for unlimited.
 */
function countLimit(company, key) {
  if (!company) return COUNT_LIMITS.starter[key];
  const onTrial = company.status === "trial" && !company.stripeSubscriptionId && company.planSetBy !== "platform";
  const plan = onTrial ? "starter" : (company.plan in COUNT_LIMITS ? company.plan : "starter");
  let limit = COUNT_LIMITS[plan][key];
  if (plan === "enterprise" && company.enterpriseTier in ENTERPRISE_TIER_COUNTS) limit = ENTERPRISE_TIER_COUNTS[company.enterpriseTier][key];
  const ov = company.limitOverrides || {};
  // Overrides saved before full/light seats were split used one `users` cap.
  const raw = key === "fullUsers" && key in ov ? ov[key] : (key === "fullUsers" && "users" in ov ? ov.users : ov[key]);
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  return limit;
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

module.exports = {featureAvailable, companyHasFeature, aiCreditsLimit, companyAiCredits, countLimit, COUNT_LIMITS, ENTERPRISE_TIER_COUNTS};
