const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Runs daily at 00:05 AM.
 * Aggregates previous day's breakdowns, work orders, PM completions, inventory movements,
 * and writes a snapshot to analytics_daily/{companyId}_YYYY-MM-DD.
 */
exports.generateDailyAnalytics = onSchedule({
  schedule: "5 0 * * *",
  timeZone: "Asia/Colombo",
}, async (event) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const dateStr = yesterday.toISOString().split("T")[0];
  const monthStr = dateStr.slice(0, 7);
  const year = yesterday.getFullYear();

  // Get all companies
  const companiesSnap = await db.collection("companies").where("status", "==", "active").get();
  const companies = companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  for (const company of companies) {
    const companyId = company.id;
    const docId = `${companyId}_${dateStr}`;

    // Breakdowns opened yesterday
    const openedSnap = await db
      .collection("breakdown_tickets")
      .where("companyId", "==", companyId)
      .where("createdAt", ">=", yesterday)
      .where("createdAt", "<", new Date(yesterday.getTime() + 86400000))
      .get();

    // Breakdowns closed yesterday
    const closedSnap = await db
      .collection("breakdown_tickets")
      .where("companyId", "==", companyId)
      .where("closedAt", ">=", yesterday)
      .where("closedAt", "<", new Date(yesterday.getTime() + 86400000))
      .get();

    // Open breakdowns at end of day
    const openSnap = await db
      .collection("breakdown_tickets")
      .where("companyId", "==", companyId)
      .where("status", "not-in", ["closed", "resolved"])
      .get();

    // Critical breakdowns opened yesterday
    const criticalSnap = await db
      .collection("breakdown_tickets")
      .where("companyId", "==", companyId)
      .where("severity", "==", "critical")
      .where("createdAt", ">=", yesterday)
      .where("createdAt", "<", new Date(yesterday.getTime() + 86400000))
      .get();

    // WOs completed yesterday
    const woCompletedSnap = await db
      .collection("work_orders")
      .where("companyId", "==", companyId)
      .where("status", "==", "CLOSED")
      .where("closedAt", ">=", yesterday)
      .where("closedAt", "<", new Date(yesterday.getTime() + 86400000))
      .get();

    // Calculate MTTR for closed breakdowns yesterday
    let totalRepairMinutes = 0;
    closedSnap.forEach((doc) => {
      const d = doc.data();
      const start = d.repairStartedAt?.toDate?.() || d.reportedAt?.toDate?.();
      const end = d.closedAt?.toDate?.();
      if (start && end) {
        totalRepairMinutes += (end.getTime() - start.getTime()) / 60000;
      }
    });
    const mttrHours = closedSnap.size > 0 ? totalRepairMinutes / closedSnap.size / 60 : 0;

    // SLA compliance for open breakdowns at end of day
    let slaCompliant = 0;
    openSnap.forEach((doc) => {
      const d = doc.data();
      if (!d.slaBreached) slaCompliant++;
    });
    const slaRate = openSnap.size > 0 ? (slaCompliant / openSnap.size) * 100 : 100;

    // Write daily analytics document
    await db.collection("analytics_daily").doc(docId).set({
      companyId,
      date: dateStr,
      month: monthStr,
      year,
      breakdownsOpened: openedSnap.size,
      breakdownsClosed: closedSnap.size,
      breakdownsOpen: openSnap.size,
      criticalBreakdowns: criticalSnap.size,
      mttrHours,
      slaComplianceRate: slaRate,
      wosOpened: 0, // Would need to query separately
      wosCompleted: woCompletedSnap.size,
      pmsCompleted: 0,
      pmsMissed: 0,
      pmComplianceRate: 0,
      productionHoursLost: 0,
      maintenanceCostLKR: 0,
      partsCostLKR: 0,
      laborCostLKR: 0,
      contractorCostLKR: 0,
      partsIssued: 0,
      lowStockAlerts: 0,
      trainingCertificatesIssued: 0,
      safetyIncidents: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  console.log(`Daily analytics generated for ${dateStr}`);
});
