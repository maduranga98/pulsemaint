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

module.exports = {
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
