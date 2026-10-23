/**
 * What is cleared after a year — and, just as important, what never is.
 *
 * Only FINISHED long-term records are listed (closed / cancelled work orders
 * and PM work, breakdowns, work permits, safety cases, completed PM history,
 * submitted evaluations) plus inventory clutter (stock movements and import
 * sessions). Open work is never touched. Kept forever: contractors, users,
 * RCA (`rca`), the blacklist, plants, departments, company details, machines,
 * inventory parts and suppliers, training records and certificates.
 *
 * Pure data + helpers (no firebase imports) so it can be unit-tested.
 */

const RETENTION_DAYS = 365;

/**
 * Each rule: a flat collection, the timestamp it ages by (the date the record
 * finished, so a long-running job isn't cleared the day it closes), and the
 * statuses that count as finished. `statusField: null` = every record ages out.
 */
const RETENTION_RULES = [
  {collection: "workOrders", dateField: "closedAt", statusField: "status", statuses: ["CLOSED"]},
  {collection: "workOrders", dateField: "cancelledAt", statusField: "status", statuses: ["CANCELLED"]},
  {collection: "breakdown_tickets", dateField: "closedAt", statusField: "status", statuses: ["closed"]},
  {collection: "breakdown_tickets", dateField: "cancelledAt", statusField: "status", statuses: ["cancelled"]},
  {collection: "work_permits", dateField: "closedAt", statusField: "status", statuses: ["closed"]},
  {collection: "safety_cases", dateField: "closedAt", statusField: "status", statuses: ["closed"]},
  {collection: "pm_history", dateField: "completedDate", statusField: "status", statuses: ["completed_on_time", "completed_late"]},
  {collection: "pm_history", dateField: "missedAt", statusField: "status", statuses: ["missed"]},
  {collection: "evaluations", dateField: "submittedAt", statusField: "status", statuses: null},
  {collection: "stockMovements", dateField: "createdAt", statusField: null, statuses: null},
  {collection: "inventoryImportSessions", dateField: "createdAt", statusField: null, statuses: null},
];

/** Collections that must never be cleared by the retention job. */
const NEVER_CLEARED = ["contractors", "users", "rca", "safety_blacklist_resets", "plants", "departments", "companies", "machines", "inventoryParts", "suppliers"];

/**
 * Whether a record is finished and old enough to clear.
 * @param {object} rule one of RETENTION_RULES
 * @param {object} data the document data
 * @param {number} nowMs current time in ms
 * @return {boolean} true when it may be deleted
 */
function isExpired(rule, data, nowMs) {
  if (rule.statusField && rule.statuses && !rule.statuses.includes(data[rule.statusField])) return false;
  const v = data[rule.dateField];
  const ms = v && typeof v.toMillis === "function" ? v.toMillis() : null;
  if (ms === null) return false;
  return nowMs - ms > RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Collections that are not part of the company export (pure clutter), so there
 * is nothing to wait for before clearing them.
 */
const NOT_EXPORTED = ["inventoryImportSessions"];

/**
 * What the clean-up does with one record. Expired data is only deleted once a
 * company export that started AFTER the record finished has completed, so the
 * admin always holds a copy first.
 *
 * @param {object} rule one of RETENTION_RULES
 * @param {object} data the document data
 * @param {number} nowMs current time in ms
 * @param {number|null} lastExportMs when the company's last successful export started
 * @return {"keep"|"delete"|"blocked"} blocked = expired but not exported yet
 */
function classify(rule, data, nowMs, lastExportMs) {
  if (!isExpired(rule, data, nowMs)) return "keep";
  if (NOT_EXPORTED.includes(rule.collection)) return "delete";
  if (!companyOf(data)) return "delete"; // belongs to no company, so no export can ever hold it
  const finishedMs = data[rule.dateField].toMillis();
  return lastExportMs && finishedMs <= lastExportMs ? "delete" : "blocked";
}

/**
 * @param {object} data the document data
 * @return {string|null} the company the record belongs to
 */
function companyOf(data) {
  return data.companyId || data.siteId || data.tenantId || null;
}

/**
 * Storage files that belong to ONE record and go with it: a file under this
 * company's folder whose path has the record id as a folder
 * (e.g. breakdowns/<company>/<ticketId>/media/…). A file that merely appears
 * on the record but lives elsewhere (shared with another record) is kept.
 *
 * @param {string} docId the record's document id
 * @param {object} data the record's data (serialised or raw)
 * @param {string} bucketName the default bucket
 * @return {string[]} storage paths to delete
 */
function ownedFilePaths(docId, data, bucketName) {
  const companyId = companyOf(data);
  if (!companyId) return [];
  const {collectAttachments} = require("../exports/exportPlan");
  const {allowed} = collectAttachments(data, {bucketName, companyId, plantIds: []});
  return allowed.filter((path) => path.split("/").slice(2, -1).includes(docId));
}

module.exports = {RETENTION_DAYS, RETENTION_RULES, NEVER_CLEARED, NOT_EXPORTED, isExpired, classify, companyOf, ownedFilePaths};
