const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {sendNotification} = require("../lib/notify");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Fires when a new trainingAssignments doc is created for an offboard/
// external training module — notify the employee and HR.
exports.onOffboardTrainingAssigned = onDocumentCreated(
  {database: "default", document: "trainingAssignments/{assignmentId}"},
  async (event) => {
    const assignment = event.data.data();
    if (!assignment || assignment.category !== "offboard") return;

    const companyId = assignment.companyId || "";
    if (!companyId) return;

    try {
      await sendNotification(db, {
        companyId,
        type: "training",
        message: `You have been assigned "${assignment.moduleName || "an offboard training"}"`,
        oversightMessage: `${assignment.traineeName || "An employee"} has been assigned "${assignment.moduleName || "an offboard training"}"`,
        linkTo: "/app/training",
        roles: ["hr_officer"],
        userIds: [assignment.traineeId],
        dedupeKey: `offboard-assigned:${event.params.assignmentId}`,
      });
    } catch (err) {
      logger.error("onOffboardTrainingAssigned failed", {error: err.message, assignmentId: event.params.assignmentId});
    }
  }
);
