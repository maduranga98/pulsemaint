const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {sendNotification} = require("../lib/notify");
const {db, FieldValue, calculateVariance, logger} = require("./shared");

exports.notifyInvoiceVariance = onDocumentUpdated({ database: "default", document: "contractorJobs/{jobId}" }, async (event) => {
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
    await sendNotification(db, {
      companyId: after.companyId,
      type: "alert",
      message: `Invoice variance of ${variance.invoiceVariancePercent}% on contractor job ${after.workOrderNumber || event.params.jobId}` +
        (after.contractorName ? ` (${after.contractorName})` : ""),
      severity: "high",
      linkTo: `/app/contractors/jobs/${event.params.jobId}/invoice`,
      roles: ["hr_officer", "supervisor"],
      dedupeKey: `invoice-variance:${event.params.jobId}:${variance.invoiceVariancePercent}`,
    });
  }

  logger.info("Invoice variance recalculated", {contractorJobId: event.params.jobId, ...variance});
});
