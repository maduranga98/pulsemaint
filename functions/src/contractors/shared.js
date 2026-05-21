const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

const CRITICAL_DOCUMENT_TYPES = [
  "insurance_certificate",
  "workmen_compensation",
  "trade_license",
  "safety_certificate",
];

function calculateDaysUntilExpiry(expiryTimestamp) {
  if (!expiryTimestamp) return null;
  const expiry = expiryTimestamp.toDate ? expiryTimestamp.toDate() : new Date(expiryTimestamp);
  const now = new Date();
  const expiryMidnight = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((expiryMidnight.getTime() - nowMidnight.getTime()) / 86400000);
}

function validityStatusFromDays(daysUntilExpiry, isPermanent) {
  if (isPermanent || daysUntilExpiry === null) return "valid";
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 30) return "expiring_soon";
  return "valid";
}

function calculateVariance(systemTotal, contractorTotal) {
  const amount = Math.abs((contractorTotal || 0) - (systemTotal || 0));
  const percent = systemTotal > 0 ? (amount / systemTotal) * 100 : contractorTotal > 0 ? 100 : 0;
  return {
    invoiceVarianceAmount: Number(amount.toFixed(2)),
    invoiceVariancePercent: Number(percent.toFixed(2)),
    invoiceVarianceFlagged: percent > 10,
  };
}

async function getUsersByCompanyAndRoles(companyId, roles) {
  const snap = await db.collection("users").where("companyId", "==", companyId).where("role", "in", roles).get();
  return snap.docs.map((doc) => doc.id);
}

async function createNotificationLog(companyId, payload) {
  await db.collection("companies").doc(companyId).collection("notificationLogs").add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
}

module.exports = {
  db,
  logger,
  FieldValue,
  Timestamp,
  CRITICAL_DOCUMENT_TYPES,
  calculateDaysUntilExpiry,
  validityStatusFromDays,
  calculateVariance,
  getUsersByCompanyAndRoles,
  createNotificationLog,
};
