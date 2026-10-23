/**
 * `retentionStatus/{companyId}` — server-written state of the one-year clean-up
 * for one company, read by the admin's banner:
 *   noticeActive   expired records are waiting for the admin to export them
 *   pendingCount   how many (at least — a run looks at a bounded number)
 *   byCollection   {collection: count}
 *   oldestExpiredAt  ms of the oldest one
 *   lastExportAt   ms when the last successful export started (records finished
 *                  before that are covered by it and may be deleted)
 */
const {FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const NOTICE_TYPE = "retention_expiry";

/**
 * Removes the "export your data" notifications of a company (the bell entry
 * goes away as soon as the export succeeded or nothing is waiting any more).
 *
 * @param {FirebaseFirestore.Firestore} db the "default" database
 * @param {string} companyId owning company
 * @return {Promise<number>} how many were removed
 */
async function removeRetentionNotifications(db, companyId) {
  const snap = await db.collection("notifications")
      .where("companyId", "==", companyId).where("type", "==", NOTICE_TYPE).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/**
 * A company export finished: its records up to `startedAtMs` are now safe to
 * clear, so the banner and the bell notice go away. Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db the "default" database
 * @param {string} companyId owning company
 * @param {string} exportId the finished export job
 * @param {number} startedAtMs when that export started (it read everything finished before)
 * @return {Promise<void>}
 */
async function markCompanyExported(db, companyId, exportId, startedAtMs) {
  try {
    await db.collection("retentionStatus").doc(companyId).set({
      companyId,
      noticeActive: false,
      pendingCount: 0,
      lastExportAt: startedAtMs,
      lastExportId: exportId,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    await removeRetentionNotifications(db, companyId);
  } catch (err) {
    logger.error(`markCompanyExported failed for ${companyId}`, err);
  }
}

module.exports = {NOTICE_TYPE, removeRetentionNotifications, markCompanyExported};
