const {onDocumentWritten, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Keeps the two service columns of the machine registry (and the machine
// profile, which reads the same fields) in step with maintenance activity:
//
//  - Next PM: the earliest due date among the machine's active PM schedules,
//    refreshed whenever a schedule is created, edited, paused, completed or
//    deleted — so scheduling a PM shows up there immediately.
//  - Last service: the sign-off/completion time of the most recent work order
//    of any type (PM, corrective, breakdown …) on that machine.

const DONE_WO_STATUSES = ["COMPLETED", "SIGNED_OFF", "CLOSED"];

async function refreshNextPmDue(machineId) {
  if (!machineId) return;
  const machineRef = db.collection("machines").doc(String(machineId));
  const machineSnap = await machineRef.get();
  if (!machineSnap.exists) return;

  const schedules = await db
      .collection("pm_schedules")
      .where("machineId", "==", String(machineId))
      .where("status", "==", "active")
      .get();

  let earliest = null;
  schedules.forEach((d) => {
    const due = d.data().nextDueDate;
    if (due && typeof due.toMillis === "function" && (!earliest || due.toMillis() < earliest.toMillis())) {
      earliest = due;
    }
  });

  const machine = machineSnap.data();
  if (earliest) {
    const current = machine.nextPmDue;
    if (current && typeof current.toMillis === "function" && current.toMillis() === earliest.toMillis()) return;
    await machineRef.update({
      nextPmDue: earliest,
      nextPmDueSource: "schedule",
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else if (machine.nextPmDueSource === "schedule" && machine.nextPmDue) {
    // The date was derived from a schedule that no longer exists/is active.
    // A date typed in by hand (no source) is left alone.
    await machineRef.update({
      nextPmDue: null,
      nextPmDueSource: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

exports.syncMachineNextPm = onDocumentWritten(
    {database: "default", document: "pm_schedules/{scheduleId}"},
    async (event) => {
      const before = event.data.before.exists ? event.data.before.data() : null;
      const after = event.data.after.exists ? event.data.after.data() : null;
      const machineIds = new Set([before && before.machineId, after && after.machineId].filter(Boolean));
      for (const machineId of machineIds) {
        try {
          await refreshNextPmDue(machineId);
        } catch (err) {
          logger.error("syncMachineNextPm failed", {machineId, err});
        }
      }
    },
);

exports.syncMachineLastService = onDocumentUpdated(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (!after.machineId) return;
      if (DONE_WO_STATUSES.includes(before.status) || !DONE_WO_STATUSES.includes(after.status)) return;

      try {
        const doneAt = after.actualEndTime && typeof after.actualEndTime.toMillis === "function" ?
          after.actualEndTime :
          Timestamp.now();
        const machineRef = db.collection("machines").doc(String(after.machineId));
        const machineSnap = await machineRef.get();
        if (!machineSnap.exists) return;
        const last = machineSnap.data().lastServiceDate;
        // Only ever move the date forward.
        if (last && typeof last.toMillis === "function" && last.toMillis() >= doneAt.toMillis()) return;
        await machineRef.update({
          lastServiceDate: doneAt,
          lastServiceType: after.woType || null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.error("syncMachineLastService failed", {woId: event.params.woId, err});
      }
    },
);
