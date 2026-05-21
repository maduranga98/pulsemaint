const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Triggered when a breakdown work order is CLOSED.
 * Calculates actual repair time and updates running MTTR for the machine and company.
 */
exports.recalculateMttr = onDocumentUpdated(
  {
    document: "work_orders/{woId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only run when WO becomes closed and is linked to a breakdown
    if (before.status === "CLOSED" || after.status !== "CLOSED" || !after.linkedBreakdownId) return;

    const companyId = after.companyId || after.siteId;
    const machineId = after.machineId;
    if (!companyId || !machineId) return;

    const actualStart = after.actualStartTime?.toDate?.();
    const actualEnd = after.actualEndTime?.toDate?.();
    if (!actualStart || !actualEnd) return;

    const repairHours = (actualEnd.getTime() - actualStart.getTime()) / 3600000;

    // Update machine_health MTTR
    const healthRef = db.collection("machine_health").doc(`${companyId}_${machineId}`);
    const healthSnap = await healthRef.get();
    const healthData = healthSnap.data() || {};
    const currentMttr = healthData.mttrHours || 0;
    const closedCount = (healthData.closedBreakdownCount || 0) + 1;
    const newMttr = ((currentMttr * (closedCount - 1)) + repairHours) / closedCount;

    await healthRef.set({
      mttrHours: Number(newMttr.toFixed(2)),
      closedBreakdownCount: closedCount,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Update today's analytics_daily MTTR
    const todayStr = new Date().toISOString().split("T")[0];
    const dailyRef = db.collection("analytics_daily").doc(`${companyId}_${todayStr}`);
    const dailySnap = await dailyRef.get();
    const dailyData = dailySnap.data() || {};
    const dailyClosed = (dailyData.breakdownsClosed || 0);
    const dailyMttr = dailyData.mttrHours || 0;
    const newDailyMttr = dailyClosed > 0
      ? ((dailyMttr * dailyClosed) + repairHours) / (dailyClosed + 1)
      : repairHours;

    await dailyRef.set({
      mttrHours: Number(newDailyMttr.toFixed(2)),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
);
