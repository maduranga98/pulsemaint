/**
 * getMoeAggregates
 * Callable: input {tenantId, startDate, endDate, machineId?} (dates as
 * ISO strings), output plant-average MOE (criticality-weighted), Top 10
 * best, Top 10 worst, and the Critical list — aggregated server-side from
 * `moeSnapshots` over the range.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");
const CRITICAL_THRESHOLD_DEFAULT = 70;

const getMoeAggregates = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }
  const { tenantId, startDate, endDate, machineId } = request.data || {};
  if (!tenantId || !startDate || !endDate) {
    throw new HttpsError("invalid-argument", "tenantId, startDate, endDate are required");
  }

  try {
    let q = db
        .collection("moeSnapshots")
        .where("siteId", "==", tenantId)
        .where("periodStart", ">=", Timestamp.fromDate(new Date(startDate)))
        .where("periodStart", "<=", Timestamp.fromDate(new Date(endDate)));
    if (machineId) {
      q = q.where("machineId", "==", machineId);
    }
    const snap = await q.get();

    const byMachine = new Map();
    snap.docs.forEach((doc) => {
      const s = doc.data();
      const existing = byMachine.get(s.machineId) || {
        machineId: s.machineId,
        criticality: s.criticality || 1,
        scoreSum: 0,
        count: 0,
      };
      existing.scoreSum += s.moeScore;
      existing.count += 1;
      existing.criticality = s.criticality || existing.criticality;
      byMachine.set(s.machineId, existing);
    });

    const machines = Array.from(byMachine.values()).map((m) => ({
      machineId: m.machineId,
      criticality: m.criticality,
      moeScore: Math.round((m.scoreSum / m.count) * 10) / 10,
    }));

    const totalWeight = machines.reduce((sum, m) => sum + m.criticality, 0);
    const plantAverageMoe = totalWeight > 0 ?
      Math.round((machines.reduce((sum, m) => sum + m.moeScore * m.criticality, 0) / totalWeight) * 10) / 10 :
      0;

    const sorted = [...machines].sort((a, b) => b.moeScore - a.moeScore);
    const best = sorted.slice(0, 10);
    const worst = [...sorted].reverse().slice(0, 10);
    const critical = machines.filter(
        (m) => m.criticality >= 4 && m.moeScore < CRITICAL_THRESHOLD_DEFAULT,
    );

    return {
      plantAverageMoe,
      machineCount: machines.length,
      best,
      worst,
      critical,
    };
  } catch (err) {
    logger.error("getMoeAggregates failed", err);
    throw new HttpsError("internal", "Failed to compute MOE aggregates");
  }
});

module.exports = { getMoeAggregates };
