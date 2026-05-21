const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { db, FieldValue, logger } = require("./shared");

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.toMillis() - start.toMillis()) / 60000));
}

async function recalculateContractorMetricsFor(contractorId, companyId) {
  const snap = await db
    .collection("contractorJobs")
    .where("companyId", "==", companyId)
    .where("contractorId", "==", contractorId)
    .get();
  const jobs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const ratedJobs = jobs.filter((job) => job.rating);
  const breakdownJobs = jobs.filter((job) => String(job.workOrderType).toLowerCase().includes("breakdown"));
  const signedJobs = jobs.filter((job) => job.signedOffAt);
  const invoicedJobs = jobs.filter((job) => job.invoiceStatus && job.invoiceStatus !== "pending");
  const mttrValues = breakdownJobs.map((job) => minutesBetween(job.arrivedAt, job.workCompletedAt || job.signedOffAt)).filter((value) => value !== null);
  const responseTimes = jobs.map((job) => minutesBetween(job.invitationSentAt, job.arrivedAt)).filter((value) => value !== null);
  const lastJob = signedJobs.sort((a, b) => (b.signedOffAt?.toMillis() || 0) - (a.signedOffAt?.toMillis() || 0))[0];

  await db.collection("contractors").doc(contractorId).update({
    totalJobsCount: jobs.length,
    breakdownJobsCount: breakdownJobs.length,
    pmJobsCount: jobs.filter((job) => String(job.workOrderType).toLowerCase().includes("pm") || String(job.workOrderType).toLowerCase().includes("preventive")).length,
    installationJobsCount: jobs.filter((job) => String(job.workOrderType).toLowerCase().includes("install")).length,
    avgRating: average(ratedJobs.map((job) => job.rating.overallScore || 0)),
    ratingCount: ratedJobs.length,
    avgMttr: average(mttrValues),
    firstFixRate: jobs.length ? Number(((jobs.filter((job) => !job.followUpRequired).length / jobs.length) * 100).toFixed(2)) : 0,
    slaComplianceRate: signedJobs.length
      ? Number(((signedJobs.filter((job) => job.slaDeadline && job.signedOffAt && job.signedOffAt.toMillis() <= job.slaDeadline.toMillis()).length / signedJobs.length) * 100).toFixed(2))
      : 0,
    avgJobCost: average(jobs.map((job) => (job.systemLaborCost || 0) + (job.totalPartsFactoryCost || 0))),
    avgResponseTime: average(responseTimes),
    invoiceAccuracyRate: invoicedJobs.length
      ? Number(((invoicedJobs.filter((job) => !job.invoiceVarianceFlagged).length / invoicedJobs.length) * 100).toFixed(2))
      : 0,
    repeatBreakdownRate: breakdownJobs.length
      ? Number(((breakdownJobs.filter((job) => job.followUpRequired).length / breakdownJobs.length) * 100).toFixed(2))
      : 0,
    lastJobDate: lastJob?.signedOffAt || null,
    lastJobId: lastJob?.id || "",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

exports.recalculateContractorMetricsFor = recalculateContractorMetricsFor;

exports.recalculateContractorMetrics = onDocumentUpdated({ database: "default", document: "contractorJobs/{jobId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.contractorId) return;
  const statusChangedToSignedOff = before.status !== after.status && after.status === "signed_off";
  const ratingChanged = JSON.stringify(before.rating || null) !== JSON.stringify(after.rating || null);
  if (!statusChangedToSignedOff && !ratingChanged) return;

  await recalculateContractorMetricsFor(after.contractorId, after.companyId);
  logger.info("Contractor metrics recalculated", { contractorId: after.contractorId });
});
