const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {sendNotification} = require("../lib/notify");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const db = getFirestore("default");

exports.checkRetrainingTrigger = onDocumentUpdated({ database: "default", document: "companies/{companyId}/trainingCertificates/{certificateId}" }, async (event) => {
  const after = event.data.after.data();
  if (!after.expiryDate) return;
  const expiry = after.expiryDate.toDate ? after.expiryDate.toDate() : new Date(after.expiryDate);
  const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (daysRemaining > 30 || after.retrainingQueuedAt) return;

  await event.data.after.ref.update({retrainingQueuedAt: FieldValue.serverTimestamp()});
  await sendNotification(db, {
    companyId: event.params.companyId,
    type: "training",
    message: "Retraining due: a training certificate is nearing expiry",
    linkTo: "/app/training",
    roles: ["hr_officer", "supervisor"],
    dedupeKey: `retraining:${event.params.certificateId}`,
  });
});
