const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

exports.generateTrainingCertificate = onDocumentUpdated({ database: "default", document: "trainingAssignments/{assignmentId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status || after.status !== "completed") return;

  const companyId = after.companyId || "";
  const certificateRef = db.collection("companies").doc(companyId).collection("trainingCertificates").doc();
  await certificateRef.set({
    id: certificateRef.id,
    companyId,
    assignmentId: event.params.assignmentId,
    traineeId: after.traineeId || "",
    moduleId: after.moduleId || "",
    issuedAt: FieldValue.serverTimestamp(),
    status: "active",
  });
  logger.info("Generated training certificate", {assignmentId: event.params.assignmentId});
});
