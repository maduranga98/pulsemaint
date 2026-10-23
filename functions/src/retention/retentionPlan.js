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

module.exports = {RETENTION_DAYS, RETENTION_RULES, NEVER_CLEARED, isExpired};
