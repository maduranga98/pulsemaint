const crypto = require("crypto");
const {FieldValue} = require("firebase-admin/firestore");

/**
 * Builds a document for the in-app `notifications` collection — the only one
 * the bell reads — in the same shape `createNotification()` writes on the
 * client. A notification reaches exactly the roles and users it names (admins
 * and plant managers are not copied automatically) and carries the plant and,
 * when known, the department it came from.
 *
 * @param {object} input notification fields
 * @return {object} the document to store (without the timestamp)
 */
function buildNotificationDoc(input) {
  const roles = Array.from(new Set(input.roles || []));
  const userIds = Array.from(new Set((input.userIds || []).filter(Boolean)));
  return {
    companyId: input.companyId,
    type: input.type || "alert",
    message: input.message,
    oversightMessage: input.oversightMessage || null,
    severity: input.severity || "medium",
    linkTo: input.linkTo || null,
    read: false,
    readBy: [],
    recipientRoles: roles,
    recipientUserIds: userIds,
    targetRoles: roles,
    targetUserIds: userIds,
    actorName: null,
    actorRole: null,
    actorUserId: null,
    plantId: input.plantId || null,
    department: input.department || null,
    actorDepartment: input.actorDepartment || null,
  };
}

/**
 * Writes one bell notification. With a `dedupeKey` the document id is derived
 * from it and written with create(), so a retried trigger or a re-run
 * schedule can never post the same alert twice.
 *
 * Never throws — a failed notification must not fail the work that raised it.
 *
 * @param {FirebaseFirestore.Firestore} db the "default" database
 * @param {object} input see buildNotificationDoc, plus optional dedupeKey
 * @return {Promise<boolean>} true when a new notification was written
 */
async function sendNotification(db, input) {
  if (!input.companyId || !input.message) return false;
  const doc = {...buildNotificationDoc(input), timestamp: FieldValue.serverTimestamp()};
  try {
    if (input.dedupeKey) return await writeOnce(db, input.companyId, input.dedupeKey, doc);
    await db.collection("notifications").add(doc);
    return true;
  } catch (err) {
    // ALREADY_EXISTS (6) means the dedupe key was already used — expected.
    if (err && err.code !== 6) console.error("sendNotification failed", err);
    return false;
  }
}

/**
 * Writes a notification document exactly once per key, for good. A marker in
 * `notificationDedupe` outlives the notification itself (read notifications are
 * deleted), so a schedule that runs again later never re-posts an alert that
 * was already sent and read. Markers are swept after DEDUPE_RETENTION_DAYS.
 *
 * @param {FirebaseFirestore.Firestore} db the "default" database
 * @param {string} companyId owning company
 * @param {string} key what this alert is about (e.g. "training:<id>:overdue")
 * @param {object} doc the full notification document (with timestamp)
 * @return {Promise<boolean>} true when written now, false when already sent
 */
async function writeOnce(db, companyId, key, doc) {
  const id = crypto.createHash("sha1").update(`${companyId}|${key}`).digest("hex");
  const batch = db.batch();
  batch.create(db.collection("notificationDedupe").doc(id), {companyId, key, createdAt: FieldValue.serverTimestamp()});
  batch.create(db.collection("notifications").doc(id), doc);
  try {
    await batch.commit();
    return true;
  } catch (err) {
    if (err && err.code === 6) return false;
    throw err;
  }
}

/** How long a "sent once" marker is kept (longer than any alert can repeat). */
const DEDUPE_RETENTION_DAYS = 120;

module.exports = {buildNotificationDoc, sendNotification, writeOnce, DEDUPE_RETENTION_DAYS};
