/**
 * backfillMoeSnapshots
 * One-time callable to populate historical `moeSnapshots` from existing
 * breakdown/PM data so the MOE dashboard isn't empty at launch. Functional,
 * not production-grade: iterates day-by-day for the requested range for
 * every active machine of the given tenant. Admin/plant_manager only.
 *
 * Invoke via Firebase console "Run function" test harness, `firebase
 * functions:shell`, or an HTTPS callable client call:
 *   firebase functions:shell
 *   > backfillMoeSnapshots({tenantId: '<companyId>', days: 90})
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { calculateAndUpsertSnapshot } = require("./calculateDailyMoeSnapshots");

const db = getFirestore("default");

const backfillMoeSnapshots = onCall({timeoutSeconds: 540}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }
  const { tenantId, days = 90 } = request.data || {};
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId is required");
  }

  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const role = userDoc.exists ? userDoc.data().role : null;
  if (!["admin", "plant_manager"].includes(role)) {
    throw new HttpsError("permission-denied", "Only admin/plant_manager may backfill MOE data");
  }

  const machinesSnap = await db
      .collection("machines")
      .where("siteId", "==", tenantId)
      .get();

  let written = 0;
  const clampedDays = Math.min(Math.max(Number(days) || 90, 1), 366);

  for (const doc of machinesSnap.docs) {
    const machine = {id: doc.id, ...doc.data()};
    if (machine.status === "decommissioned") continue;

    for (let i = 0; i < clampedDays; i++) {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      dayStart.setUTCDate(dayStart.getUTCDate() - i - 1);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      try {
        await calculateAndUpsertSnapshot(machine, dayStart, dayEnd);
        written += 1;
      } catch (err) {
        logger.error(`backfillMoeSnapshots failed for machine ${machine.id} day ${i}`, err);
      }
    }
  }

  logger.info(`backfillMoeSnapshots: wrote ${written} snapshots for tenant ${tenantId}`);
  return { written, machineCount: machinesSnap.size, days: clampedDays };
});

module.exports = { backfillMoeSnapshots };
