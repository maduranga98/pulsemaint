const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore("default");

/**
 * Runs daily at 00:15 AM (after generateDailyAnalytics at 00:05).
 * Aggregates timeSegments from work_orders closed in the previous day into
 * the `metricsDaily` collection keyed by `{companyId}_{YYYY-MM-DD}`.
 *
 * Computes per-state durations (travel, waiting-parts, waiting-permit, working)
 * and wrench time percentage (working / total tracked time).
 */
exports.metricsDaily = onSchedule(
  {
    schedule: "15 0 * * *",
    timeZone: "Asia/Colombo",
  },
  async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const dayEnd = new Date(yesterday.getTime() + 86400000);

    const dateStr = yesterday.toISOString().split("T")[0];
    const monthStr = dateStr.slice(0, 7);
    const year = yesterday.getFullYear();

    // Get all active companies
    const companiesSnap = await db
      .collection("companies")
      .where("status", "==", "active")
      .get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      const docId = `${companyId}_${dateStr}`;

      // Fetch work orders that were closed/completed yesterday
      const woSnap = await db
        .collection("work_orders")
        .where("companyId", "==", companyId)
        .where("status", "in", ["CLOSED", "COMPLETED"])
        .where("closedAt", ">=", yesterday)
        .where("closedAt", "<", dayEnd)
        .get();

      // State buckets (milliseconds)
      const stateTotals = {
        travel: 0,
        "waiting-parts": 0,
        "waiting-permit": 0,
        working: 0,
      };

      let woWithSegments = 0;
      let totalSegments = 0;
      const perWoWrenchTimes = [];

      woSnap.forEach((woDoc) => {
        const wo = woDoc.data();
        const segments = wo.timeSegments ?? [];
        if (!Array.isArray(segments) || segments.length === 0) return;

        woWithSegments++;
        let woTotalMs = 0;
        let woWorkingMs = 0;

        for (const seg of segments) {
          // Both startAt and endAt must be present to count
          if (!seg.startAt || !seg.endAt) continue;

          const startMs =
            typeof seg.startAt.toMillis === "function"
              ? seg.startAt.toMillis()
              : seg.startAt._seconds != null
                ? seg.startAt._seconds * 1000
                : null;

          const endMs =
            typeof seg.endAt.toMillis === "function"
              ? seg.endAt.toMillis()
              : seg.endAt._seconds != null
                ? seg.endAt._seconds * 1000
                : null;

          if (startMs == null || endMs == null || endMs <= startMs) continue;

          const durationMs = endMs - startMs;
          const state = seg.state ?? "working";

          if (state in stateTotals) {
            stateTotals[state] += durationMs;
          } else {
            stateTotals.working += durationMs; // default unknown to working
          }

          if (state === "working") {
            woWorkingMs += durationMs;
          }
          woTotalMs += durationMs;
          totalSegments++;
        }

        if (woTotalMs > 0) {
          perWoWrenchTimes.push((woWorkingMs / woTotalMs) * 100);
        }
      });

      const grandTotalMs =
        stateTotals.travel +
        stateTotals["waiting-parts"] +
        stateTotals["waiting-permit"] +
        stateTotals.working;

      const wrenchTimePercent =
        grandTotalMs > 0
          ? Math.round((stateTotals.working / grandTotalMs) * 100 * 10) / 10
          : null;

      const avgWrenchTimePerWo =
        perWoWrenchTimes.length > 0
          ? Math.round(
              (perWoWrenchTimes.reduce((a, b) => a + b, 0) /
                perWoWrenchTimes.length) *
                10,
            ) / 10
          : null;

      // Convert ms totals to minutes for storage
      const toMinutes = (ms) => Math.round(ms / 60000);

      await db
        .collection("metricsDaily")
        .doc(docId)
        .set(
          {
            companyId,
            date: dateStr,
            month: monthStr,
            year,
            // Work order counts
            wosProcessed: woSnap.size,
            wosWithTimeSegments: woWithSegments,
            totalSegmentsLogged: totalSegments,
            // Per-state totals (minutes)
            travelMinutes: toMinutes(stateTotals.travel),
            waitingPartsMinutes: toMinutes(stateTotals["waiting-parts"]),
            waitingPermitMinutes: toMinutes(stateTotals["waiting-permit"]),
            workingMinutes: toMinutes(stateTotals.working),
            totalTrackedMinutes: toMinutes(grandTotalMs),
            // Wrench time
            wrenchTimePercent,
            avgWrenchTimePercentPerWo: avgWrenchTimePerWo,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    }

    console.log(`metricsDaily aggregation complete for ${dateStr}`);
  },
);
