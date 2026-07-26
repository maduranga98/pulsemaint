const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
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
  const [snap, contractorSnap] = await Promise.all([
    db
      .collection("contractorJobs")
      .where("companyId", "==", companyId)
      .where("contractorId", "==", contractorId)
      .get(),
    db.collection("contractors").doc(contractorId).get(),
  ]);
  const jobs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const ratedJobs = jobs.filter((job) => job.rating);
  const signedJobs = jobs.filter((job) => job.signedOffAt);
  // "Jobs done" — actually signed off, not merely invited/in-progress —
  // filtered from that same completed set, plus whatever the contractor was
  // credited with when added to the registry (previouslyCompletedProjects).
  const breakdownJobs = signedJobs.filter((job) => String(job.workOrderType).toLowerCase().includes("breakdown"));
  const invoicedJobs = jobs.filter((job) => job.invoiceStatus && job.invoiceStatus !== "pending");
  const mttrValues = breakdownJobs.map((job) => minutesBetween(job.arrivedAt, job.workCompletedAt || job.signedOffAt)).filter((value) => value !== null);
  const responseTimes = jobs.map((job) => minutesBetween(job.invitationSentAt, job.arrivedAt)).filter((value) => value !== null);
  const lastJob = signedJobs.sort((a, b) => (b.signedOffAt?.toMillis() || 0) - (a.signedOffAt?.toMillis() || 0))[0];
  const priorJobsCount = contractorSnap.exists ? (contractorSnap.data().previouslyCompletedProjects || []).length : 0;

  await db.collection("contractors").doc(contractorId).update({
    totalJobsCount: signedJobs.length + priorJobsCount,
    breakdownJobsCount: breakdownJobs.length,
    pmJobsCount: signedJobs.filter((job) => String(job.workOrderType).toLowerCase().includes("pm") || String(job.workOrderType).toLowerCase().includes("preventive")).length,
    installationJobsCount: signedJobs.filter((job) => String(job.workOrderType).toLowerCase().includes("install")).length,
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

// The Jobs column also credits whatever prior work the contractor was
// registered with (previouslyCompletedProjects), entered on the Add
// Contractor form. Recompute whenever that list changes on an existing
// contractor (edits) — creation is handled by recalculateContractorMetricsOnCreate below.
exports.recalculateContractorMetricsOnProjectsEdit = onDocumentUpdated({ database: "default", document: "contractors/{contractorId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const beforeCount = (before.previouslyCompletedProjects || []).length;
  const afterCount = (after.previouslyCompletedProjects || []).length;
  if (beforeCount === afterCount) return;

  await recalculateContractorMetricsFor(event.params.contractorId, after.companyId);
  logger.info("Contractor metrics recalculated after previouslyCompletedProjects edit", { contractorId: event.params.contractorId });
});

// Ensures a freshly-registered contractor's Jobs count reflects any
// previouslyCompletedProjects entered at registration immediately, rather
// than relying on the client to compute it (and staying at the client's
// naive default otherwise).
exports.recalculateContractorMetricsOnCreate = onDocumentCreated({ database: "default", document: "contractors/{contractorId}" }, async (event) => {
  const data = event.data.data();
  if (!data) return;
  await recalculateContractorMetricsFor(event.params.contractorId, data.companyId);
  logger.info("Contractor metrics initialized on create", { contractorId: event.params.contractorId });
});
