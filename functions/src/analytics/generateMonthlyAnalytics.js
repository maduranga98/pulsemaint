const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const db = getFirestore("default");

/**
 * Runs on the 1st of each month at 00:30 AM.
 * Finalizes previous month's analytics_monthly document with rankings and breakdowns.
 */
exports.generateMonthlyAnalytics = onSchedule({
  schedule: "30 0 1 * *",
  timeZone: "Asia/Colombo",
}, async () => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  const companiesSnap = await db.collection("companies").where("status", "==", "active").get();

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    const docId = `${companyId}_${monthStr}`;

    // Sum daily analytics for the month
    const dailySnap = await db
        .collection("analytics_daily")
        .where("companyId", "==", companyId)
        .where("month", "==", monthStr)
        .get();

    let totalBreakdowns = 0;
    let totalMttr = 0;
    let totalSlaCompliant = 0;
    let totalSlaTotal = 0;
    let totalWosCompleted = 0;
    let totalCost = 0;
    let totalHoursLost = 0;

    dailySnap.forEach((doc) => {
      const d = doc.data();
      totalBreakdowns += d.breakdownsOpened || 0;
      totalMttr += d.mttrHours || 0;
      totalSlaCompliant += Math.round((d.slaComplianceRate || 0) * (d.breakdownsOpen || 0) / 100);
      totalSlaTotal += d.breakdownsOpen || 0;
      totalWosCompleted += d.wosCompleted || 0;
      totalCost += d.maintenanceCostLKR || 0;
      totalHoursLost += d.productionHoursLost || 0;
    });

    const dayCount = dailySnap.size || 1;

    // Get top problem machines
    const machineHealthSnap = await db
        .collection("machine_health")
        .where("companyId", "==", companyId)
        .orderBy("breakdownCountMTD", "desc")
        .limit(10)
        .get();

    const topProblemMachines = machineHealthSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        machineId: d.machineId,
        machineName: d.machineName,
        breakdownCount: d.breakdownCountMTD || 0,
        downtimeHours: d.mttrHours || 0,
        cost: d.maintenanceCostMTD || 0,
        criticality: 3, // Default, would need machine registry lookup
      };
    });

    // Get technician performance
    const techSnap = await db
        .collection("technician_status")
        .where("companyId", "==", companyId)
        .get();

    const technicianPerformance = techSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        techId: d.userId,
        techName: d.name,
        jobsCompleted: d.jobsCompletedToday || 0,
        avgResponseMins: d.avgResponseTimeMins || 0,
        avgRepairHours: d.avgRepairTimeHours || 0,
        slaCompliance: 100,
      };
    });

    // Write monthly analytics
    await db.collection("analytics_monthly").doc(docId).set({
      companyId,
      month: monthStr,
      year: prevMonth.getFullYear(),
      totalBreakdowns,
      avgMttrHours: totalMttr / dayCount,
      avgMtbfDays: 0, // Would need uptime calculation
      overallSlaCompliance: totalSlaTotal > 0 ? (totalSlaCompliant / totalSlaTotal) * 100 : 100,
      totalMaintenanceCost: totalCost,
      totalProductionHoursLost: totalHoursLost,
      totalWosCompleted,
      pmComplianceRate: 0,
      topProblemMachines,
      technicianPerformance,
      contractorPerformance: [],
      breakdownByType: {},
      breakdownBySeverity: {},
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  }

  console.log(`Monthly analytics generated for ${monthStr}`);
});
