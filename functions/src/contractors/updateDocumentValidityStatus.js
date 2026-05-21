const {onSchedule} = require("firebase-functions/v2/scheduler");
const {
  db,
  logger,
  FieldValue,
  calculateDaysUntilExpiry,
  validityStatusFromDays,
} = require("./shared");

function notificationKey(daysUntilExpiry, status) {
  if (status === "expired") return "expired";
  if (daysUntilExpiry === 30) return "expiring_30";
  if (daysUntilExpiry === 7) return "expiring_7";
  return "";
}

exports.updateDocumentValidityStatus = onSchedule("0 7 * * *", async () => {
  const snap = await db
      .collectionGroup("documents")
      .where("hasExpiry", "==", true)
      .where("isPermanent", "==", false)
      .get();

  const contractorBlocks = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    const daysUntilExpiry = calculateDaysUntilExpiry(data.expiryDate);
    const validityStatus = validityStatusFromDays(daysUntilExpiry, data.isPermanent);
    const blocksAssignment = Boolean(data.isCriticalDocument && validityStatus === "expired");
    const key = notificationKey(daysUntilExpiry, validityStatus);

    const updates = {
      daysUntilExpiry,
      validityStatus,
      blocksAssignment,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (key && data.lastExpiryNotificationKey !== key) {
      updates.lastExpiryNotificationKey = key;
      await db.collection("companies").doc(data.companyId).collection("notificationLogs").add({
        type: "contractor_document_expiry",
        contractorId: data.contractorId,
        documentId: doc.id,
        documentName: data.documentName,
        status: validityStatus,
        daysUntilExpiry,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await doc.ref.update(updates);
    if (blocksAssignment) contractorBlocks.set(data.contractorId, true);
  }

  for (const [contractorId] of contractorBlocks) {
    await db.collection("contractors").doc(contractorId).update({
      blocksAssignment: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  logger.info("updateDocumentValidityStatus completed", {documents: snap.size});
});
