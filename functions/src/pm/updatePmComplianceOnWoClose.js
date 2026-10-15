/**
 * updatePmComplianceOnWoClose
 * When a PREVENTIVE work order first reaches a done status (completed,
 * signed off or closed), records the occurrence as completed on time / late
 * on its pm_history record and updates the schedule's counters and
 * compliance rate (pmCompliance.recordPmCompletion — the only writer of these
 * figures). Signed off as failed / not complete, the occurrence is recorded
 * as missed instead (recordPmNotDone). The machine's last-service / next-PM dates are kept by
 * syncMachineLastService / syncMachineNextPm.
 */

const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const {recordPmCompletion, recordPmNotDone, DONE_STATUSES, NOT_DONE_OUTCOMES} = require("./pmCompliance");

exports.updatePmComplianceOnWoClose = onDocumentUpdated({database: "default", document: "workOrders/{woId}"}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const woId = event.params.woId;
  if (after.woType !== "PREVENTIVE") return;
  // Signed off as failed / not complete: the PM wasn't done.
  if (NOT_DONE_OUTCOMES.has(after.signOffOutcome) && before.signOffOutcome !== after.signOffOutcome) {
    try {
      const status = await recordPmNotDone(woId, after);
      if (status) logger.info(`PM for WO ${woId} signed off ${after.signOffOutcome}: recorded as ${status}`);
    } catch (err) {
      logger.error(`updatePmComplianceOnWoClose (not done) failed for ${woId}`, err);
    }
    return;
  }
  if (DONE_STATUSES.has(before.status) || !DONE_STATUSES.has(after.status)) return;
  try {
    const status = await recordPmCompletion(woId, after);
    if (status) logger.info(`PM compliance updated for WO ${woId}: ${status}`);
  } catch (err) {
    logger.error(`updatePmComplianceOnWoClose failed for ${woId}`, err);
  }
});
