const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

exports.cleanupOldReports = onSchedule("every day 03:00", async () => {
  const snap = await db.collection("report_history").where("expiresAt", "<", new Date()).limit(200).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.storageUrl) {
      await getStorage().bucket().file(data.storageUrl).delete({ignoreNotFound: true});
    }
    await doc.ref.delete();
    deleted += 1;
  }
  logger.info("cleanupOldReports completed", {deleted});
});
