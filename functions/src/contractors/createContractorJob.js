const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { db, logger, FieldValue, Timestamp } = require("./shared");
const { sendJobInvitationInternal } = require("./sendJobInvitation");

function isContractorWorkOrder(wo) {
  const type = String(wo.woType || wo.workOrderType || "").toLowerCase();
  return type.includes("contractor") || Boolean(wo.contractorId || wo.contractorCompanyName);
}

exports.createContractorJob = onDocumentUpdated("workOrders/{woId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const woId = event.params.woId;

  if (!isContractorWorkOrder(after)) return;
  if (before.contractorId === after.contractorId && before.woType === after.woType) return;

  const companyId = after.companyId || after.siteId;
  if (!companyId) {
    logger.warn("createContractorJob skipped: missing companyId", { woId });
    return;
  }

  const existingSnap = await db
    .collection("contractorJobs")
    .where("companyId", "==", companyId)
    .where("workOrderId", "==", woId)
    .limit(1)
    .get();
  if (!existingSnap.empty) return;

  let contractor = {};
  let blockedDocuments = [];
  if (after.contractorId) {
    const contractorSnap = await db.collection("contractors").doc(after.contractorId).get();
    contractor = contractorSnap.exists ? contractorSnap.data() : {};
    const blockedSnap = await db
      .collection("contractors")
      .doc(after.contractorId)
      .collection("documents")
      .where("companyId", "==", companyId)
      .where("blocksAssignment", "==", true)
      .get();
    blockedDocuments = blockedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  const jobRef = db.collection("contractorJobs").doc();
  const job = {
    companyId,
    workOrderId: woId,
    workOrderNumber: after.woNumber || after.workOrderNumber || woId,
    workOrderType: after.woType || after.workOrderType || "contractor_job",
    priority: after.priority || "medium",
    slaDeadline: after.slaDeadline || null,
    machineId: after.machineId || "",
    machineName: after.machineName || "",
    machineType: after.machineType || "",
    machineLocation: after.machineLocation || after.location || "",
    machineCriticality: after.machineCriticality || 0,
    breakdownTicketId: after.linkedBreakdownId || after.breakdownTicketId || null,
    breakdownDescription: after.description || "",
    breakdownSeverity: after.breakdownSeverity || "",
    contractorId: after.contractorId || "",
    contractorName: contractor.companyName || after.contractorCompanyName || after.manualContractorName || "",
    contractorType: contractor.companyType || "",
    isManuallyEntered: !after.contractorId,
    manualContractorName: after.manualContractorName || after.contractorCompanyName || "",
    contactPerson: contractor.primaryContactName || after.contractorContactPerson || "",
    contactPhone: contractor.primaryPhone || after.contractorContactNumber || "",
    technicianNames: after.contractorTechnicianNames || [],
    technicianIds: after.contractorTechnicianIds || [],
    expectedArrivalTime: after.expectedArrivalTime || null,
    status: "invitation_sent",
    invitationSentAt: Timestamp.now(),
    workSteps: [],
    partsFromFactory: [],
    partsFromContractor: [],
    totalPartsFactoryCost: 0,
    totalPartsCost: 0,
    checklistResults: [],
    photoUrls: [],
    beforePhotoUrls: [],
    afterPhotoUrls: [],
    documentUrls: [],
    invoiceStatus: "pending",
    complianceWarning: blockedDocuments.length
      ? `Expired critical documents: ${blockedDocuments.map((doc) => doc.documentName).join(", ")}`
      : "",
    createdBy: after.createdBy || after.supervisorInChargeId || "",
    createdByName: after.createdByName || after.supervisorInChargeName || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await jobRef.set(job);

  try {
    await sendJobInvitationInternal({
      contractorJobId: jobRef.id,
      companyId,
      sentBy: job.createdBy || "system",
    });
  } catch (err) {
    if (err instanceof HttpsError) logger.warn("Invitation failed", err.message);
    else logger.error("Invitation failed", err);
  }

  logger.info("Contractor job created", { contractorJobId: jobRef.id, woId });
});
