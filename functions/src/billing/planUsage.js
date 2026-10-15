/**
 * getPlanUsage — the company-wide count of a plan-limited resource (machines,
 * inventory items, active PM schedules, users, work orders this month).
 *
 * Plan limits are per company, but plant-scoped roles may only read their
 * own plant's records (firestore.rules), so the browser can't count the
 * whole company itself. Any active member may ask — it returns a number,
 * never the records.
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {requireMember} = require("../lib/access");
const {safeZone, localDateKey, localDayWindow} = require("../lib/zonedTime");

const RESOURCES = new Set(["machines", "inventoryItems", "pmSchedules", "users", "workOrdersThisMonth"]);

exports.getPlanUsage = onCall({maxInstances: 20}, async (request) => {
  const {companyId, resource} = request.data || {};
  if (typeof companyId !== "string" || !companyId) throw new HttpsError("invalid-argument", "companyId is required.");
  if (!RESOURCES.has(resource)) throw new HttpsError("invalid-argument", "Unknown resource.");
  await requireMember(request, companyId);

  const db = getFirestore("default");
  let q;
  if (resource === "machines") {
    q = db.collection("machines").where("siteId", "==", companyId);
  } else if (resource === "inventoryItems") {
    q = db.collection("inventoryParts").where("companyId", "==", companyId);
  } else if (resource === "pmSchedules") {
    q = db.collection("pm_schedules").where("companyId", "==", companyId).where("status", "in", ["active", "paused"]);
  } else if (resource === "users") {
    q = db.collection(`companies/${companyId}/users`);
  } else {
    // Since the start of this month on the company's own calendar.
    const company = await db.collection("companies").doc(companyId).get();
    const timeZone = safeZone(company.exists ? company.data().timezone : null);
    const monthStart = localDayWindow(`${localDateKey(new Date(), timeZone).slice(0, 7)}-01`, timeZone).start;
    q = db.collection("workOrders").where("siteId", "==", companyId).where("createdAt", ">=", Timestamp.fromDate(monthStart));
  }
  const snap = await q.count().get();
  return {count: snap.data().count};
});
