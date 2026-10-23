const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {sendNotification, DEDUPE_RETENTION_DAYS} = require("../lib/notify");

const db = getFirestore("default");

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// A breakdown nobody has acknowledged is the one alert that must not be
// missed, so it escalates in two steps instead of waiting for someone to
// open the bell.
const ESCALATION_STEPS = [
  {key: "30", afterMs: 30 * MINUTE, severity: "high", roles: ["supervisor"]},
  {key: "60", afterMs: 60 * MINUTE, severity: "critical", roles: ["supervisor", "plant_manager", "admin"]},
];

// How long a notification is kept. The bell only reads the latest ones, so
// anything older is dead weight that slows the feed down.
const RETENTION_MS = 45 * DAY;

/**
 * Which escalation steps a still-unacknowledged breakdown has reached.
 *
 * @param {number} ageMs time since it was reported
 * @return {Array<object>} the steps due, oldest first
 */
function dueEscalations(ageMs) {
  return ESCALATION_STEPS.filter((s) => ageMs >= s.afterMs);
}

/**
 * Re-alerts when a reported breakdown is still unattended after 30 / 60
 * minutes. Each step is posted once per ticket (deterministic id), so the
 * schedule can run as often as it likes without repeating itself.
 */
exports.escalateUnackedBreakdowns = onSchedule("every 10 minutes", async () => {
  const now = Date.now();
  // Only equality on status — no composite index needed; the set of tickets
  // still in "reported" is small because they leave it as soon as acked.
  const snap = await db.collection("breakdown_tickets").where("status", "==", "reported").get();
  let sent = 0;
  for (const docSnap of snap.docs) {
    const t = docSnap.data();
    const reportedAt = t.reportedAt && t.reportedAt.toMillis ? t.reportedAt.toMillis() : null;
    const companyId = t.companyId || t.siteId;
    if (!reportedAt || !companyId) continue;
    const ageMin = Math.round((now - reportedAt) / MINUTE);
    // Only the most severe step reached — earlier ones were already posted.
    const steps = dueEscalations(now - reportedAt);
    const step = steps[steps.length - 1];
    if (!step) continue;
    const machine = t.machineName || "A machine";
    const wrote = await sendNotification(db, {
      companyId,
      type: "breakdown",
      message: `${machine}: breakdown still not acknowledged after ${ageMin} minutes`,
      oversightMessage: `Breakdown on ${machine} has been unacknowledged for ${ageMin} minutes`,
      severity: step.severity,
      linkTo: "/app/breakdowns",
      roles: step.roles,
      plantId: t.machinePlantId || null,
      department: t.machineDepartment || null,
      dedupeKey: `breakdown-escalation:${docSnap.id}:${step.key}`,
    });
    if (wrote) sent++;
  }
  if (sent) logger.info("escalateUnackedBreakdowns", {sent});
});

/** Daily: deletes notifications past the retention window, in batches. */
exports.cleanupOldNotifications = onSchedule("every day 03:30", async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_MS);
  let total = 0;
  for (;;) {
    const snap = await db.collection("notifications").where("timestamp", "<", cutoff).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  if (total) logger.info(`cleanupOldNotifications: deleted ${total} notification(s)`);
});

/** Roles that are narrowed to their own department (matches firestore.rules). */
const DEPARTMENT_ROLES = ["technician", "trainee", "supervisor", "floor_operator"];

/**
 * Whether a person is one the notification was raised for: named directly, or
 * holding a named role in the notification's plant (and department, for the
 * department-scoped roles).
 * @param {object} n the notification
 * @param {string} uid the person's id
 * @param {object} profile their company profile
 * @return {boolean} true when they are part of its audience
 */
function isAudience(n, uid, profile) {
  if ((n.recipientUserIds || []).includes(uid)) return true;
  if (!(n.recipientRoles || []).includes(profile.role)) return false;
  if (n.plantId && profile.plantId && n.plantId !== profile.plantId) return false;
  if (n.department && profile.department && DEPARTMENT_ROLES.includes(profile.role) && n.department !== profile.department) return false;
  return true;
}

/**
 * A notification is deleted once everyone it was raised for has read it (or
 * cleared it with "read all"); until then it stays for those who haven't.
 * The "sent once" marker in notificationDedupe keeps schedules from re-posting.
 */
exports.deleteReadNotification = onDocumentUpdated({database: "default", document: "notifications/{id}"}, async (event) => {
  const after = event.data?.after?.data();
  if (!after || !after.companyId) return;
  const readBy = new Set(after.readBy || []);
  if (readBy.size === 0) return;
  const people = await db.collection(`companies/${after.companyId}/users`).get();
  const audience = people.docs.filter((d) => d.get("status") !== "inactive" && isAudience(after, d.id, d.data()));
  if (audience.every((d) => readBy.has(d.id))) await event.data.after.ref.delete();
});

/** Daily: drops "sent once" markers old enough that the alert can never repeat. */
exports.cleanupNotificationDedupe = onSchedule("every day 04:00", async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - DEDUPE_RETENTION_DAYS * DAY);
  let total = 0;
  for (;;) {
    const snap = await db.collection("notificationDedupe").where("createdAt", "<", cutoff).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  if (total) logger.info(`cleanupNotificationDedupe: removed ${total} marker(s)`);
});

exports.isAudience = isAudience;
exports.dueEscalations = dueEscalations;
exports.RETENTION_MS = RETENTION_MS;
