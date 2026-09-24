const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Server-side mirror of src/lib/machineOperationalStatus.ts. The client
// helpers only run for roles that can write the machine doc, so a breakdown
// reported by a floor operator (or anonymously via a QR scan) never flipped
// the machine, and a sign-off could re-check before its linked breakdown was
// closed. These triggers run with admin rights and fire on every write, so
// the machine registry stays in sync whoever made the change.
const CLOSED_BREAKDOWN_STATUSES = new Set(["resolved", "closed", "cancelled"]);
const TERMINAL_WO_STATUSES = new Set(["SIGNED_OFF", "CLOSED", "CANCELLED"]);

async function markUnderMaintenance(machineId) {
  if (!machineId) return;
  const ref = db.collection("machines").doc(machineId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const status = snap.data().status;
  if (status === "decommissioned" || status === "under_maintenance") return;
  await ref.update({status: "under_maintenance", updatedAt: FieldValue.serverTimestamp()});
  logger.info("Machine marked under maintenance", {machineId});
}

async function markActiveIfNoOpenWork(machineId) {
  if (!machineId) return;
  const ref = db.collection("machines").doc(machineId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const status = snap.data().status;
  if (status === "decommissioned" || status === "active") return;

  const [breakdownSnap, woSnap] = await Promise.all([
    db.collection("breakdown_tickets").where("machineId", "==", machineId).get(),
    db.collection("workOrders").where("machineId", "==", machineId).get(),
  ]);
  const hasOpenBreakdown = breakdownSnap.docs.some(
      (d) => !CLOSED_BREAKDOWN_STATUSES.has(d.data().status || ""),
  );
  const hasOpenWO = woSnap.docs.some(
      (d) => !TERMINAL_WO_STATUSES.has(d.data().status || ""),
  );
  if (hasOpenBreakdown || hasOpenWO) return;

  await ref.update({status: "active", updatedAt: FieldValue.serverTimestamp()});
  logger.info("Machine reactivated — no open breakdowns or work orders", {machineId});
}

exports.markMachineDownOnBreakdownReported = onDocumentCreated(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    async (event) => {
      const ticket = event.data && event.data.data();
      if (!ticket || CLOSED_BREAKDOWN_STATUSES.has(ticket.status || "")) return;
      try {
        await markUnderMaintenance(ticket.machineId);
      } catch (err) {
        logger.error("markMachineDownOnBreakdownReported failed", {ticketId: event.params.ticketId, err});
      }
    },
);

exports.reactivateMachineOnBreakdownClose = onDocumentUpdated(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (before.status === after.status) return;
      if (!CLOSED_BREAKDOWN_STATUSES.has(after.status || "")) return;
      try {
        await markActiveIfNoOpenWork(after.machineId);
      } catch (err) {
        logger.error("reactivateMachineOnBreakdownClose failed", {ticketId: event.params.ticketId, err});
      }
    },
);

exports.reactivateMachineOnWOSignOff = onDocumentUpdated(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (before.status === after.status) return;
      if (!TERMINAL_WO_STATUSES.has(after.status || "")) return;
      try {
        await markActiveIfNoOpenWork(after.machineId);
      } catch (err) {
        logger.error("reactivateMachineOnWOSignOff failed", {woId: event.params.woId, err});
      }
    },
);
