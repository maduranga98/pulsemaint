/**
 * generateMonthlyAnalytics — keeps analytics_monthly/{companyId}_{YYYY-MM}
 * equal to the dashboards' monthly figures (buildMonthlyAnalytics, a port of
 * the browser's computation): the current month to date every day, and the
 * previous month during the first days of a new one (late sign-offs still
 * land in it). Months are each company's own calendar months.
 *
 * It used to run once a month for "active" companies only (trials never got
 * a document) and sum analytics_daily into figures with their own rules —
 * MTBF and PM compliance were always 0, SLA came from breakdown tickets
 * (which carry no SLA deadline) and MTTR was an average of daily averages.
 * The dashboards don't read this collection; scheduled executive reports do.
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {buildMonthlyAnalytics} = require("./monthlyAnalytics");
const {safeZone, localDateKey} = require("../lib/zonedTime");

const db = getFirestore("default");
// Recompute the previous month for this many days into a new one.
const PREVIOUS_MONTH_GRACE_DAYS = 3;

const rows = (snap) => snap.docs.map((d) => ({id: d.id, ...d.data()}));

/**
 * @param {string} month YYYY-MM
 * @return {string} the month before
 */
function previousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

exports.generateMonthlyAnalytics = onSchedule({
  schedule: "20 1 * * *",
  timeZone: "UTC",
  timeoutSeconds: 540,
  memory: "1GiB",
}, async () => {
  const now = new Date();
  const started = Date.now();
  const companiesSnap = await db.collection("companies").get();
  let written = 0;

  for (const companyDoc of companiesSnap.docs) {
    if (Date.now() - started > 480 * 1000) {
      logger.warn(`generateMonthlyAnalytics: stopped at the time limit after ${written} documents`);
      break;
    }
    const company = companyDoc.data();
    if (company.status === "suspended") continue;
    const companyId = companyDoc.id;
    try {
      const timeZone = safeZone(company.timezone);
      const today = localDateKey(now, timeZone);
      const months = [today.slice(0, 7)];
      if (Number(today.slice(8, 10)) <= PREVIOUS_MONTH_GRACE_DAYS) months.push(previousMonth(months[0]));

      const [breakdowns, workOrders, contractorJobs, pmHistory, machines] = await Promise.all([
        db.collection("breakdown_tickets").where("companyId", "==", companyId).get().then(rows),
        db.collection("workOrders").where("companyId", "==", companyId).get().then(rows),
        db.collection("contractorJobs").where("companyId", "==", companyId).get().then(rows),
        db.collection("pm_history").where("companyId", "==", companyId).get().then(rows),
        db.collection("machines").where("siteId", "==", companyId).get().then(rows),
      ]);
      const raw = {breakdowns, workOrders, contractorJobs, pmHistory, machines};

      for (const month of months) {
        const figures = buildMonthlyAnalytics(companyId, month, raw, {timeZone, now});
        await db.collection("analytics_monthly").doc(`${companyId}_${month}`).set({
          ...figures,
          timeZone,
          updatedAt: FieldValue.serverTimestamp(),
        });
        written += 1;
      }
    } catch (err) {
      logger.error(`generateMonthlyAnalytics failed for ${companyId}`, err);
    }
  }
  logger.info(`generateMonthlyAnalytics: ${written} monthly documents written`);
});

exports.previousMonth = previousMonth;
