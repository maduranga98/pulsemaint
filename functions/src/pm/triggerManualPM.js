/**
 * triggerManualPM
 * Callable for supervisors / plant managers / admins to raise a PM work order
 * from a schedule right now ("Trigger now"). The schedule's own next due
 * date is left as it is — this is an extra occurrence.
 *
 * Input: { scheduleId } → { woId, woNumber }
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {requireMember} = require("../lib/access");
const {generatePmWorkOrder} = require("./generatePmWorkOrder");

const db = getFirestore("default");

exports.triggerManualPM = onCall({cors: true}, async (request) => {
  const scheduleId = request.data && request.data.scheduleId;
  if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated");
  if (typeof scheduleId !== "string" || !scheduleId) throw new HttpsError("invalid-argument", "scheduleId is required");

  const scheduleSnap = await db.collection("pm_schedules").doc(scheduleId).get();
  if (!scheduleSnap.exists) throw new HttpsError("not-found", "PM schedule not found");
  const schedule = scheduleSnap.data();
  // Only a manager of the schedule's own company may raise its PM.
  const caller = await requireMember(request, schedule.companyId, {roles: ["admin", "plant_manager", "supervisor", "maintenance_supervisor"]});
  if (schedule.status !== "active") throw new HttpsError("failed-precondition", "PM schedule is not active");

  let name = request.auth.token.name || null;
  if (!name) {
    const profile = await db.doc(`companies/${schedule.companyId}/users/${request.auth.uid}`).get();
    name = profile.exists ? profile.data().fullName || null : null;
  }

  try {
    const res = await generatePmWorkOrder({
      scheduleId,
      source: "manual",
      dueDate: new Date(),
      actor: {uid: caller.uid, name},
    });
    if (!res) throw new HttpsError("failed-precondition", "PM schedule is not active");
    logger.info(`Manual PM triggered: ${res.woNumber} for schedule ${scheduleId}`);
    return {woId: res.woId, woNumber: res.woNumber};
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("triggerManualPM failed", err);
    throw new HttpsError("internal", "Failed to trigger manual PM");
  }
});
