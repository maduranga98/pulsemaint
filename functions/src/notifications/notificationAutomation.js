const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {sendNotification} = require("../lib/notify");

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

exports.dueEscalations = dueEscalations;
exports.RETENTION_MS = RETENTION_MS;
