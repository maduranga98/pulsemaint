const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const db = getFirestore("default");

exports.checkRetrainingTrigger = onDocumentUpdated({ database: "default", document: "companies/{companyId}/trainingCertificates/{certificateId}" }, async (event) => {
  const after = event.data.after.data();
  if (!after.expiryDate) return;
  const expiry = after.expiryDate.toDate ? after.expiryDate.toDate() : new Date(after.expiryDate);
  const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (daysRemaining > 30 || after.retrainingQueuedAt) return;

  await event.data.after.ref.update({retrainingQueuedAt: FieldValue.serverTimestamp()});
  await db.collection("companies").doc(event.params.companyId).collection("notificationLogs").add({
    type: "training_retraining_due",
    title: "Retraining due",
    body: "A training certificate is nearing expiry.",
    certificateId: event.params.certificateId,
    targetRoles: ["hr_officer", "supervisor", "admin"],
    createdAt: FieldValue.serverTimestamp(),
  });
});
