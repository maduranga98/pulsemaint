const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Triggered when a work order status changes.
 * Updates technician_status document when technician starts or completes a job.
 */
exports.updateTechnicianStatus = onDocumentUpdated(
  {
    document: "work_orders/{woId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const companyId = after.companyId || after.siteId;

    if (!companyId) return;

    const techIds = after.assignedTechnicianIds || [];
    if (techIds.length === 0) return;

    const primaryTechId = techIds[0];
    const statusRef = db.collection("technician_status").doc(`${companyId}_${primaryTechId}`);

    // Job started
    if (before.status !== "IN_PROGRESS" && after.status === "IN_PROGRESS") {
      await statusRef.set({
        companyId,
        userId: primaryTechId,
        name: after.assignedTechnicianNames?.[0] || "Technician",
        currentStatus: "on_job",
        currentWoId: event.params.woId,
        currentWoNumber: after.woNumber,
        currentMachineName: after.machineName,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Job completed
    if (before.status !== "CLOSED" && after.status === "CLOSED") {
      const snap = await statusRef.get();
      const current = snap.data() || {};
      const jobsCompletedToday = (current.jobsCompletedToday || 0) + 1;

      await statusRef.set({
        companyId,
        userId: primaryTechId,
        currentStatus: "available",
        currentWoId: null,
        currentWoNumber: null,
        currentMachineName: null,
        jobsCompletedToday,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
);
