/**
 * updatePmComplianceOnWoClose
 * When a PREVENTIVE work order first reaches a done status (completed,
 * signed off or closed), records the occurrence as completed on time / late
 * on its pm_history record and updates the schedule's counters and
 * compliance rate (pmCompliance.recordPmCompletion — the only writer of these
 * figures). The machine's last-service / next-PM dates are kept by
 * syncMachineLastService / syncMachineNextPm.
 */

const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const {recordPmCompletion, DONE_STATUSES} = require("./pmCompliance");

exports.updatePmComplianceOnWoClose = onDocumentUpdated({database: "default", document: "workOrders/{woId}"}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const woId = event.params.woId;
  if (after.woType !== "PREVENTIVE" || DONE_STATUSES.has(before.status) || !DONE_STATUSES.has(after.status)) return;
  try {
    const status = await recordPmCompletion(woId, after);
    if (status) logger.info(`PM compliance updated for WO ${woId}: ${status}`);
  } catch (err) {
    logger.error(`updatePmComplianceOnWoClose failed for ${woId}`, err);
  }
});
