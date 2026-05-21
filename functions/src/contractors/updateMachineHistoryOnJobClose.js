const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { db, FieldValue, logger } = require("./shared");

exports.updateMachineHistoryOnJobClose = onDocumentUpdated("contractorJobs/{jobId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status || after.status !== "signed_off") return;
  if (!after.machineId) return;

  await db.collection("machines").doc(after.machineId).set({
    lastServiceDate: after.signedOffAt || FieldValue.serverTimestamp(),
    lastServiceType: after.workOrderType,
    lastTechnicians: after.technicianNames || [],
    partsReplaced: FieldValue.arrayUnion(...(after.partsFromFactory || []).map((part) => part.partName)),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection("machineHistory").doc(after.machineId).collection("entries").add({
    woNumber: after.workOrderNumber,
    type: after.workOrderType,
    date: after.signedOffAt || FieldValue.serverTimestamp(),
    technicians: after.technicianNames || [],
    isContractorJob: true,
    contractorName: after.contractorName,
    partsUsed: after.partsFromFactory || [],
    testResult: after.testRunResult || "",
    duration: after.actualWorkDurationMinutes || 0,
    signedOffBy: after.signedOffByName || "",
    contractorJobId: event.params.jobId,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (after.workOrderId) {
    await db.collection("workOrders").doc(after.workOrderId).set({
      status: "resolved",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  logger.info("Machine history updated for contractor job", { contractorJobId: event.params.jobId });
});
