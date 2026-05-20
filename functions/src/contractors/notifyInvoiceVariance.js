const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { db, FieldValue, calculateVariance, logger } = require("./shared");

exports.notifyInvoiceVariance = onDocumentUpdated("contractorJobs/{jobId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.contractorInvoiceAmount === after.contractorInvoiceAmount) return;
  if (typeof after.contractorInvoiceAmount !== "number") return;

  const variance = calculateVariance(after.systemInvoiceAmount || 0, after.contractorInvoiceAmount);
  await event.data.after.ref.update({
    ...variance,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (variance.invoiceVarianceFlagged) {
    await db.collection("companies").doc(after.companyId).collection("notificationLogs").add({
      type: "contractor_invoice_variance",
      contractorJobId: event.params.jobId,
      contractorName: after.contractorName,
      workOrderNumber: after.workOrderNumber,
      systemAmount: after.systemInvoiceAmount || 0,
      contractorAmount: after.contractorInvoiceAmount,
      variancePercent: variance.invoiceVariancePercent,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  logger.info("Invoice variance recalculated", { contractorJobId: event.params.jobId, ...variance });
});
