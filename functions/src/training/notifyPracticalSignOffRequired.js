const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

exports.notifyPracticalSignOffRequired = onDocumentCreated("companies/{companyId}/trainingAssignments/{assignmentId}", async (event) => {
  const assignment = event.data.data();
  if (!assignment.requiresPracticalSignOff) return;
  await db.collection("companies").doc(event.params.companyId).collection("notificationLogs").add({
    type: "practical_sign_off_required",
    title: "Practical sign-off required",
    body: "A training assignment requires supervisor practical sign-off.",
    assignmentId: event.params.assignmentId,
    targetRoles: ["supervisor", "admin"],
    createdAt: FieldValue.serverTimestamp(),
  });
});
