const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Triggered when a breakdown ticket is CLOSED.
 * Recalculates MTBF (Mean Time Between Failures) for the affected machine.
 */
exports.recalculateMtbf = onDocumentUpdated(
  {
    document: "breakdown_tickets/{ticketId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only run when ticket becomes closed
    if (before.status === "closed" || after.status !== "closed") return;

    const companyId = after.companyId || after.siteId;
    const machineId = after.machineId;
    if (!companyId || !machineId) return;

    // Get all closed breakdowns for this machine, ordered by closedAt
    const closedSnap = await db
      .collection("breakdown_tickets")
      .where("machineId", "==", machineId)
      .where("status", "==", "closed")
      .orderBy("closedAt", "asc")
      .get();

    if (closedSnap.size < 2) return; // Need at least 2 breakdowns to calculate MTBF

    // Calculate average time between failures
    let totalUptimeMs = 0;
    let intervals = 0;
    let prevClosedAt = null;

    closedSnap.forEach((doc) => {
      const d = doc.data();
      const closedAt = d.closedAt?.toDate?.();
      if (!closedAt) return;

      if (prevClosedAt) {
        totalUptimeMs += closedAt.getTime() - prevClosedAt.getTime();
        intervals++;
      }
      prevClosedAt = closedAt;
    });

    const mtbfDays = intervals > 0 ? totalUptimeMs / intervals / 86400000 : 0;

    const healthRef = db.collection("machine_health").doc(`${companyId}_${machineId}`);
    await healthRef.set({
      mtbfDays: Number(mtbfDays.toFixed(2)),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
);
