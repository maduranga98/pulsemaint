const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

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

async function addNotification(companyId, payload) {
  await db.collection("companies").doc(companyId).collection("notificationLogs").add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
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
