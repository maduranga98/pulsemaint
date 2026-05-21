const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  db,
  logger,
  FieldValue,
  Timestamp,
} = require("./shared");

function buildInvitation(job, contractor) {
  const subject = `Job Assignment - ${job.workOrderNumber} | ${job.machineName} | ${job.priority} Priority`;
  const whatsapp = [
    `Job Invitation - ${job.factoryName || "Factory"}`,
    "",
    `WO: ${job.workOrderNumber} | ${job.workOrderType}`,
    `Machine: ${job.machineName}`,
    `Location: ${job.machineLocation}`,
    `Priority: ${job.priority}`,
    `Deadline: ${job.slaDeadline?.toDate?.().toLocaleString?.() || "-"}`,
    "",
    `Contact: ${job.createdByName || "Supervisor"} - ${job.contactPhone || ""}`,
    "",
    `Full details sent to ${contractor.primaryEmail || job.recipientEmail || ""}. Please confirm receipt.`,
  ].join("\n");
  return { subject, whatsapp };
}

async function sendJobInvitationInternal({ contractorJobId, companyId, sentBy, resend = false }) {
  const jobRef = db.collection("contractorJobs").doc(contractorJobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Contractor job not found");

  const job = { id: jobSnap.id, ...jobSnap.data() };
  if (job.companyId !== companyId) throw new HttpsError("permission-denied", "Company mismatch");

  let contractor = {};
  if (job.contractorId) {
    const contractorSnap = await db.collection("contractors").doc(job.contractorId).get();
    contractor = contractorSnap.exists ? contractorSnap.data() : {};
  }

  const content = buildInvitation(job, contractor);
  logger.info("Contractor invitation prepared", {
    contractorJobId,
    subject: content.subject,
    resend,
  });

  const invitationRef = db.collection("contractorInvitations").doc();
  await invitationRef.set({
    companyId,
    contractorJobId,
    contractorId: job.contractorId || "",
    contractorName: job.contractorName || job.manualContractorName || "",
    recipientEmail: contractor.primaryEmail || job.recipientEmail || "",
    recipientPhone: contractor.primaryPhone || job.contactPhone || "",
    whatsappNumber: contractor.whatsappNumber || job.contactPhone || "",
    sentVia: ["email", "whatsapp"],
    sentAt: Timestamp.now(),
    sentBy,
    jobDetails: {
      workOrderNumber: job.workOrderNumber,
      machineName: job.machineName,
      machineLocation: job.machineLocation,
      jobType: job.workOrderType,
      description: job.breakdownDescription || job.workDoneDescription || "",
      slaDeadline: job.slaDeadline || null,
      priority: job.priority || "",
      attachedDocUrls: job.attachedDocUrls || [],
    },
    emailDelivered: true,
    whatsappDelivered: true,
    resendCount: resend ? FieldValue.increment(1) : 0,
    lastResentAt: resend ? Timestamp.now() : null,
    subject: content.subject,
    whatsappPreview: content.whatsapp,
  });

  await jobRef.update({
    invitationSentAt: job.invitationSentAt || Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, invitationId: invitationRef.id };
}

exports.sendJobInvitationInternal = sendJobInvitationInternal;

exports.sendJobInvitation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");
  const { contractorJobId, companyId, resend } = request.data;
  if (!contractorJobId || !companyId) {
    throw new HttpsError("invalid-argument", "contractorJobId and companyId are required");
  }
  return sendJobInvitationInternal({
    contractorJobId,
    companyId,
    resend: Boolean(resend),
    sentBy: request.auth.uid,
  });
});
