const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {sendNotification} = require("../lib/notify");

const db = getFirestore("default");

function asDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

function minutesBetween(start, end) {
  const startDate = asDate(start);
  const endDate = asDate(end);
  if (!startDate || !endDate) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "_");
}

function getCompanyId(data) {
  return data.companyId || data.siteId || data.factoryId || "";
}

// Handover alerts used to be written to companies/{id}/notificationLogs, which
// nothing reads, so they never reached anyone. They now go to the bell's
// `notifications` collection like every other alert.
async function addNotification(companyId, payload) {
  await sendNotification(db, {
    companyId,
    type: "alert",
    message: payload.title ? `${payload.title}: ${payload.body || ""}`.trim() : payload.body,
    oversightMessage: payload.body || null,
    severity: /unaccepted_60|critical/.test(payload.type || "") ? "high" : "medium",
    linkTo: "/app/shift/handover/history",
    roles: payload.targetRoles,
    userIds: payload.targetUserIds,
    dedupeKey: payload.dedupeKey,
  });
}

function requireAuth(request) {
  if (!request.auth) {
    const {HttpsError} = require("firebase-functions/v2/https");
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
}

/**
 * Signed in as a real (non-anonymous) member of `companyId`. Callables that
 * take a companyId from the client must check this — being signed in alone
 * would let any account (including the anonymous public-report login) read
 * or write another company's data.
 */
async function requireCompanyMember(request, companyId) {
  const {HttpsError} = require("firebase-functions/v2/https");
  requireAuth(request);
  if (request.auth.token?.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Sign in with your FirmiCore account.");
  }
  const profile = await db.collection("users").doc(request.auth.uid).get();
  if (!profile.exists || profile.get("companyId") !== companyId) {
    throw new HttpsError("permission-denied", "You do not belong to this company.");
  }
  return profile.data();
}

module.exports = {
  requireCompanyMember,
  db,
  logger,
  FieldValue,
  Timestamp,
  asDate,
  minutesBetween,
  countBy,
  normalizeStatus,
  getCompanyId,
  addNotification,
  requireAuth,
};
