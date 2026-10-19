const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {sendNotification} = require("../lib/notify");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore("default");

exports.notifyPracticalSignOffRequired = onDocumentCreated({ database: "default", document: "trainingAssignments/{assignmentId}" }, async (event) => {
  const assignment = event.data.data();
  if (!assignment.requiresPracticalSignOff) return;
  const companyId = assignment.companyId || "";
  await sendNotification(db, {
    companyId,
    type: "training",
    message: "A training assignment requires supervisor practical sign-off",
    linkTo: "/app/training",
    roles: ["supervisor"],
    dedupeKey: `practical-signoff:${event.params.assignmentId}`,
  });
});
