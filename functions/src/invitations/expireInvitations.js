/**
 * expireInvitations
 * Runs daily via Cloud Scheduler.
 *
 * Marks company invitations that are still "pending" past their expiry date as
 * "expired", so they stop counting as seats against the plan's user limit and
 * show as expired (with a resend option) in Settings → Users. Only
 * companies/{companyId}/invitations documents are touched.
 */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

const BATCH_SIZE = 400;
const MAX_BATCHES = 25;

exports.expireInvitations = onSchedule({schedule: "0 3 * * *", timeZone: "Asia/Colombo"}, async () => {
  const now = Timestamp.now();
  let expired = 0;

  try {
    for (let i = 0; i < MAX_BATCHES; i++) {
      const snap = await db.collectionGroup("invitations")
          .where("status", "==", "pending")
          .where("expiresAt", "<", now)
          .limit(BATCH_SIZE)
          .get();
      const docs = snap.docs.filter((d) => d.ref.path.startsWith("companies/"));
      if (docs.length === 0) break;

      const batch = db.batch();
      docs.forEach((d) => batch.update(d.ref, {status: "expired", expiredAt: FieldValue.serverTimestamp()}));
      await batch.commit();
      expired += docs.length;
    }
    logger.info(`expireInvitations: ${expired} invitation(s) marked expired`);
  } catch (err) {
    logger.error("expireInvitations failed", err);
  }
});
