const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Staff Requests: work orders / breakdowns shared with a requester through a
// record_access request (record_access_grants) are only viewable until their
// expiresAt. The client already hides them the moment they expire; this
// deletes the expired copies so the record data is actually gone.
exports.purgeExpiredRecordGrants = onSchedule("every 15 minutes", async () => {
  // This project's Firestore database is named "default" (see firebase.json).
  const db = getFirestore("default");
  const now = Timestamp.now();
  let total = 0;
  for (;;) {
    const snap = await db
      .collection("record_access_grants")
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  if (total) logger.info(`purgeExpiredRecordGrants: deleted ${total} expired grant(s)`);
});
