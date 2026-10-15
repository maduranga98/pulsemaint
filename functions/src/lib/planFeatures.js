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
  starter: {autoPOEmail: false, qrLowStockAlerts: false, aiAssist: false, analyticsReports: false, advancedAnalytics: false},
  workshop: {autoPOEmail: true, qrLowStockAlerts: true, aiAssist: true, analyticsReports: true, advancedAnalytics: false},
  factory: {autoPOEmail: true, qrLowStockAlerts: true, aiAssist: true, analyticsReports: true, advancedAnalytics: true},
  enterprise: {autoPOEmail: true, qrLowStockAlerts: true, aiAssist: true, analyticsReports: true, advancedAnalytics: true},
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

// Monthly work-order cap — mirror of workOrdersPerMonth in src/lib/planLimits.ts
// (plan, Enterprise tier, then the per-company limitOverrides). null = unlimited.
const WORK_ORDERS_PER_MONTH = {starter: 10, workshop: 50, factory: 100, enterprise: null};
const ENTERPRISE_TIER_WORK_ORDERS = {enterprise1: 500, enterprise2: 2000, enterprise3: 6000, unlimited: null};

function workOrdersPerMonthLimit(company) {
  const plan = company && company.plan;
  let limit = Object.prototype.hasOwnProperty.call(WORK_ORDERS_PER_MONTH, plan) ? WORK_ORDERS_PER_MONTH[plan] : WORK_ORDERS_PER_MONTH.starter;
  if (plan === "enterprise" && company.enterpriseTier && Object.prototype.hasOwnProperty.call(ENTERPRISE_TIER_WORK_ORDERS, company.enterpriseTier)) {
    limit = ENTERPRISE_TIER_WORK_ORDERS[company.enterpriseTier];
  }
  const o = company && company.limitOverrides && company.limitOverrides.workOrdersPerMonth;
  if (company && company.limitOverrides && "workOrdersPerMonth" in company.limitOverrides) {
    if (o === null) limit = null;
    else if (Number.isInteger(o) && o >= 0) limit = o;
  }
  return limit;
}

/**
 * Where a company stands against its monthly work-order cap. Used by the
 * functions that create work orders on their own (PM scheduler, manual PM),
 * so they are held to the same cap as the Create Work Order form. A read
 * error leaves the company unblocked, like the feature checks above.
 */
async function monthlyWorkOrderRoom(companyId, now = new Date()) {
  const open = {limit: null, used: 0, atLimit: false};
  if (!companyId) return open;
  try {
    const db = getFirestore("default");
    const snap = await db.collection("companies").doc(companyId).get();
    const limit = workOrdersPerMonthLimit(snap.exists ? snap.data() : null);
    if (limit === null) return open;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const count = await db.collection("workOrders")
        .where("siteId", "==", companyId)
        .where("createdAt", ">=", start)
        .count().get();
    const used = count.data().count;
    return {limit, used, atLimit: used >= limit};
  } catch (err) {
    return open;
  }
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

module.exports = {featureAvailable, companyHasFeature, workOrdersPerMonthLimit, monthlyWorkOrderRoom};
