const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Triggered on write to breakdown_tickets, work_orders, or pm_history.
 * Recalculates health score for the affected machine and updates machine_health.
 */
exports.updateMachineHealth = onDocumentWritten(
  {
    document: "breakdown_tickets/{ticketId}",
    region: "us-central1",
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    const companyId = after.companyId || after.siteId;
    const machineId = after.machineId;
    if (!companyId || !machineId) return;

    const machineHealthId = `${companyId}_${machineId}`;
    const healthRef = db.collection("machine_health").doc(machineHealthId);

    // Count open breakdowns for this machine
    const openBreakdownsSnap = await db
      .collection("breakdown_tickets")
      .where("machineId", "==", machineId)
      .where("status", "not-in", ["closed", "resolved"])
      .get();

    // Count open WOs for this machine
    const openWosSnap = await db
      .collection("work_orders")
      .where("machineId", "==", machineId)
      .where("status", "in", ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_APPROVAL"])
      .get();

    // Get current health doc
    const healthSnap = await healthRef.get();
    const healthData = healthSnap.data() || {};

    // Simple health score: 100 minus penalties
    let healthScore = 100;
    healthScore -= openBreakdownsSnap.size * 15;
    healthScore -= openWosSnap.size * 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const currentStatus = openBreakdownsSnap.size > 0
      ? "breakdown"
      : openWosSnap.size > 0
        ? "maintenance"
        : healthData.currentStatus || "operational";

    await healthRef.set({
      companyId,
      machineId,
      machineName: after.machineName || healthData.machineName || machineId,
      department: after.machineDepartment || healthData.department || "",
      location: after.machineLocation || healthData.location || "",
      currentStatus,
      healthScore,
      openBreakdownCount: openBreakdownsSnap.size,
      openWoCount: openWosSnap.size,
      lastBreakdownDate: after.status === "closed" && after.closedAt
        ? after.closedAt
        : healthData.lastBreakdownDate || null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
);
