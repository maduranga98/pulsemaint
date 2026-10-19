/**
 * Server-side plan limits.
 *
 * The app checks count limits (machines, inventory parts, PM schedules, plants, users)
 * in the browser, which anyone calling Firestore directly could skip. These triggers run
 * when such a record is created and look at where it ranks among the company's records
 * (oldest first): when it is beyond the plan's limit it is removed again. Nothing is lost
 * for good — a full copy goes to `planLimitViolations`, which only Lumora staff can read.
 *
 * Imports and creates that pass the browser checks never rank beyond the limit, so they
 * are untouched. A company that is already over its limit simply cannot add more (the
 * same thing the browser does).
 *
 * Set PLAN_LIMIT_ENFORCEMENT=log to only record violations without removing anything, or
 * =off to switch the whole thing off (see functions/.env.example).
 */

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldPath, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {countLimit} = require("../lib/planFeatures");

const db = getFirestore("default");

const LIGHT_ROLES = ["floor_operator", "trainee"];

/** What each limited collection looks like. `exclude` rows don't use a slot (a scrapped machine, an inactive plant). */
const RESOURCES = {
  machines: {collection: "machines", companyField: "siteId", limitKey: "machines", exclude: {field: "status", values: ["scrapped"]}},
  inventoryParts: {collection: "inventoryParts", companyField: "companyId", limitKey: "inventoryItems"},
  pmSchedules: {collection: "pm_schedules", companyField: "companyId", limitKey: "pmSchedules", only: {field: "status", values: ["active", "paused"]}},
  plants: {collection: "plants", companyField: "companyId", limitKey: "plants", exclude: {field: "status", values: ["inactive"]}},
};

function mode() {
  const m = String(process.env.PLAN_LIMIT_ENFORCEMENT || "on").toLowerCase();
  return m === "off" || m === "log" ? m : "on";
}

/** Does this record use up a slot of the limit? */
function usesSlot(spec, data) {
  if (spec.only && !spec.only.values.includes(data[spec.only.field])) return false;
  if (spec.exclude && spec.exclude.values.includes(data[spec.exclude.field])) return false;
  return true;
}

async function countOf(query) {
  return (await query.count().get()).data().count;
}

/** How many slot-using records of the company were created before this one (ties broken by document id). */
async function slotsBefore(spec, companyId, createdAt, docId) {
  const base = () => {
    let q = db.collection(spec.collection).where(spec.companyField, "==", companyId);
    if (spec.only) q = q.where(spec.only.field, "in", spec.only.values);
    return q;
  };
  const earlier = (q) => q.where("createdAt", "<", createdAt);
  const tied = (q) => q.where("createdAt", "==", createdAt).where(FieldPath.documentId(), "<", docId);
  let n = (await countOf(earlier(base()))) + (await countOf(tied(base())));
  if (spec.exclude) {
    const excluded = () => base().where(spec.exclude.field, "in", spec.exclude.values);
    n -= (await countOf(earlier(excluded()))) + (await countOf(tied(excluded())));
  }
  return Math.max(0, n);
}

async function recordViolation(companyId, resource, snap, limit, rank, removed) {
  await db.collection("planLimitViolations").add({
    companyId,
    resource,
    docPath: snap.ref.path,
    limit,
    rank,
    removed,
    // Full copy so the record can be restored if it turns out to be a mistake.
    data: snap.data(),
    at: FieldValue.serverTimestamp(),
  });
}

/** Decide for one newly created machine / part / PM schedule / plant. Returns what happened (for tests). */
async function enforceCountLimit(resource, snap) {
  const spec = RESOURCES[resource];
  const data = snap.data();
  if (mode() === "off" || !data) return {action: "skipped"};
  const companyId = data[spec.companyField];
  if (!companyId || !data.createdAt || typeof data.createdAt.toMillis !== "function") return {action: "skipped"};
  if (!usesSlot(spec, data)) return {action: "skipped"};
  const companySnap = await db.collection("companies").doc(companyId).get();
  if (!companySnap.exists) return {action: "skipped"};
  const limit = countLimit(companySnap.data(), spec.limitKey);
  if (limit === null) return {action: "ok"};
  const rank = await slotsBefore(spec, companyId, data.createdAt, snap.id);
  if (rank < limit) return {action: "ok", rank, limit};
  const remove = mode() === "on";
  logger.warn(`Plan limit exceeded: ${resource} ${snap.ref.path} is #${rank + 1} but the limit is ${limit} (company ${companyId})${remove ? " — removing it" : " — log only"}`);
  await recordViolation(companyId, resource, snap, limit, rank, remove);
  if (remove) await snap.ref.delete();
  return {action: remove ? "removed" : "logged", rank, limit};
}

/** Seats: members that aren't deactivated, plus still-valid invitations created before this one, of the same seat type. */
async function seatsBefore(companyId, seat, inviteSnap) {
  const members = db.collection(`companies/${companyId}/users`);
  const light = () => members.where("role", "in", LIGHT_ROLES);
  const off = (q) => q.where("status", "==", "inactive");
  const [all, allOff, lightAll, lightOff] = await Promise.all([
    countOf(members), countOf(off(members)), countOf(light()), countOf(off(light())),
  ]);
  const lightMembers = lightAll - lightOff;
  const memberSeats = seat === "light" ? lightMembers : (all - allOff) - lightMembers;
  const now = Date.now();
  const mine = inviteSnap.data();
  const myCreated = mine.createdAt.toMillis();
  const pending = await db.collection(`companies/${companyId}/invitations`).where("status", "==", "pending").get();
  let invites = 0;
  pending.forEach((d) => {
    if (d.id === inviteSnap.id) return;
    const x = d.data();
    const created = x.createdAt && typeof x.createdAt.toMillis === "function" ? x.createdAt.toMillis() : null;
    if (created === null) return;
    const expires = x.expiresAt && typeof x.expiresAt.toMillis === "function" ? x.expiresAt.toMillis() : null;
    if (expires !== null && expires <= now) return;
    const isLight = LIGHT_ROLES.includes(x.role);
    if ((seat === "light") !== isLight) return;
    if (created < myCreated || (created === myCreated && d.id < inviteSnap.id)) invites += 1;
  });
  return memberSeats + invites;
}

async function enforceSeatLimit(companyId, snap) {
  const data = snap.data();
  if (mode() === "off" || !data || data.status !== "pending") return {action: "skipped"};
  if (!data.createdAt || typeof data.createdAt.toMillis !== "function") return {action: "skipped"};
  const companySnap = await db.collection("companies").doc(companyId).get();
  if (!companySnap.exists) return {action: "skipped"};
  const seat = LIGHT_ROLES.includes(data.role) ? "light" : "full";
  const limit = countLimit(companySnap.data(), seat === "light" ? "lightUsers" : "fullUsers");
  if (limit === null) return {action: "ok"};
  const used = await seatsBefore(companyId, seat, snap);
  if (used < limit) return {action: "ok", rank: used, limit};
  const remove = mode() === "on";
  logger.warn(`Plan limit exceeded: ${seat} user invitation ${snap.ref.path} would be seat #${used + 1} but the limit is ${limit} (company ${companyId})${remove ? " — removing it" : " — log only"}`);
  await recordViolation(companyId, `${seat}Users`, snap, limit, used, remove);
  if (remove) {
    if (data.token) await db.collection("inviteTokens").doc(data.token).delete().catch(() => {});
    await snap.ref.delete();
  }
  return {action: remove ? "removed" : "logged", rank: used, limit};
}

const wrap = (label, fn) => async (event) => {
  try {
    await fn(event);
  } catch (err) {
    // Fail open: a counting problem (e.g. an index still building) must never delete anything.
    logger.error(`${label} failed for ${event.document || ""}`, err);
  }
};

exports.enforceMachineLimit = onDocumentCreated({database: "default", document: "machines/{id}"},
    wrap("enforceMachineLimit", (e) => enforceCountLimit("machines", e.data)));
exports.enforcePartLimit = onDocumentCreated({database: "default", document: "inventoryParts/{id}"},
    wrap("enforcePartLimit", (e) => enforceCountLimit("inventoryParts", e.data)));
exports.enforcePmScheduleLimit = onDocumentCreated({database: "default", document: "pm_schedules/{id}"},
    wrap("enforcePmScheduleLimit", (e) => enforceCountLimit("pmSchedules", e.data)));
exports.enforcePlantLimit = onDocumentCreated({database: "default", document: "plants/{id}"},
    wrap("enforcePlantLimit", (e) => enforceCountLimit("plants", e.data)));
exports.enforceSeatLimit = onDocumentCreated({database: "default", document: "companies/{companyId}/invitations/{id}"},
    wrap("enforceSeatLimit", (e) => enforceSeatLimit(e.params.companyId, e.data)));

exports._test = {enforceCountLimit, enforceSeatLimit, usesSlot, RESOURCES};
