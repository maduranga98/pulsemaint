const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
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
      await db.collection("companies").doc(companyId).collection("notificationLogs").add({
        type: "offboard_training_assigned",
        title: "Offboard training assigned",
        body: `${assignment.traineeName || "An employee"} has been assigned "${assignment.moduleName || "an offboard training"}".`,
        assignmentId: event.params.assignmentId,
        targetUserIds: [assignment.traineeId].filter(Boolean),
        targetRoles: ["hr_officer"],
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error("onOffboardTrainingAssigned failed", {error: err.message, assignmentId: event.params.assignmentId});
    }
  }
);
