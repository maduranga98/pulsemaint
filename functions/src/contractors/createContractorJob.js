const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {HttpsError} = require("firebase-functions/v2/https");
const {db, logger, FieldValue, Timestamp} = require("./shared");
const {sendJobInvitationInternal} = require("./sendJobInvitation");

// Work orders store the assigned contractor under `contractorCompanyId` /
// `contractorCompanyName` (see src/types/workOrder.ts) — this used to check
// a `contractorId` field that never existed on any WO document, so this
// trigger's early-return conditions were always true and it never created a
// contractorJobs record for any real WO (PMGR-020).
function isContractorWorkOrder(wo) {
  const type = String(wo.woType || wo.workOrderType || "").toLowerCase();
  return type.includes("contractor") || Boolean(wo.contractorCompanyId || wo.contractorCompanyName);
}

// onDocumentWritten (not onDocumentUpdated) so a WO created directly with a
// contractor assigned — the normal path — also creates a contractorJobs
// record; onDocumentUpdated never fires on document creation at all.
exports.createContractorJob = onDocumentWritten({ database: "default", document: "workOrders/{woId}" }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const woId = event.params.woId;

  if (!after) return;
  if (!isContractorWorkOrder(after)) return;
  if (before && before.contractorCompanyId === after.contractorCompanyId && before.woType === after.woType) return;

  const companyId = after.companyId || after.siteId;
  if (!companyId) {
    logger.warn("createContractorJob skipped: missing companyId", {woId});
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
  if (after.contractorCompanyId) {
    const contractorSnap = await db.collection("contractors").doc(after.contractorCompanyId).get();
    contractor = contractorSnap.exists ? contractorSnap.data() : {};
    const blockedSnap = await db
        .collection("contractors")
        .doc(after.contractorCompanyId)
        .collection("documents")
        .where("companyId", "==", companyId)
        .where("blocksAssignment", "==", true)
        .get();
    blockedDocuments = blockedSnap.docs.map((doc) => ({id: doc.id, ...doc.data()}));
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
    contractorId: after.contractorCompanyId || "",
    contractorName: contractor.companyName || after.contractorCompanyName || after.manualContractorName || "",
    contractorType: contractor.companyType || "",
    isManuallyEntered: !after.contractorCompanyId,
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
    complianceWarning: blockedDocuments.length ?
      `Expired critical documents: ${blockedDocuments.map((doc) => doc.documentName).join(", ")}` :
      "",
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

  logger.info("Contractor job created", {contractorJobId: jobRef.id, woId});
});
