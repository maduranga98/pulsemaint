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
const OPEN_BREAKDOWN_STATUSES = [
  "reported", "acknowledged", "triage_in_progress", "assigned", "en_route",
  "repair_in_progress", "on_hold_parts", "on_hold_approval",
];
// A machine is under maintenance while it has an open breakdown, or a work
// order whose work has actually started (until sign-off — the same window
// downtime is measured over). A PM raised ahead of its due date, or a work
// order that is only assigned, doesn't take the machine out of service.
const WORK_STARTED_STATUSES = ["IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_APPROVAL", "COMPLETED"];

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

  // Only the open ones (indexed), instead of the machine's whole history.
  const [breakdownSnap, woSnap] = await Promise.all([
    db.collection("breakdown_tickets").where("machineId", "==", machineId)
        .where("status", "in", OPEN_BREAKDOWN_STATUSES).limit(1).get(),
    db.collection("workOrders").where("machineId", "==", machineId)
        .where("status", "in", WORK_STARTED_STATUSES).limit(1).get(),
  ]);
  if (!breakdownSnap.empty || !woSnap.empty) return;

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

// Work starting puts the machine under maintenance; work leaving the
// "started" states (signed off, closed, cancelled, sent back to assigned)
// reactivates it when nothing else is open on it.
exports.reactivateMachineOnWOSignOff = onDocumentUpdated(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (before.status === after.status) return;
      const startedNow = WORK_STARTED_STATUSES.includes(after.status || "");
      const startedBefore = WORK_STARTED_STATUSES.includes(before.status || "");
      try {
        if (startedNow && !startedBefore) await markUnderMaintenance(after.machineId);
        else if (!startedNow) await markActiveIfNoOpenWork(after.machineId);
      } catch (err) {
        logger.error("reactivateMachineOnWOSignOff failed", {woId: event.params.woId, err});
      }
    },
);

// A work order created already started (or a breakdown reopened after being
// closed, e.g. a sign-off "not complete") takes the machine out of service
// again — the update triggers above only see status changes into / out of the
// started and closed states.
exports.markMachineDownOnWOCreatedStarted = onDocumentCreated(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const wo = event.data && event.data.data();
      if (!wo || !WORK_STARTED_STATUSES.includes(wo.status || "")) return;
      try {
        await markUnderMaintenance(wo.machineId);
      } catch (err) {
        logger.error("markMachineDownOnWOCreatedStarted failed", {woId: event.params.woId, err});
      }
    },
);

exports.markMachineDownOnBreakdownReopened = onDocumentUpdated(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (before.status === after.status) return;
      if (!CLOSED_BREAKDOWN_STATUSES.has(before.status || "")) return;
      if (CLOSED_BREAKDOWN_STATUSES.has(after.status || "")) return;
      try {
        await markUnderMaintenance(after.machineId);
      } catch (err) {
        logger.error("markMachineDownOnBreakdownReopened failed", {ticketId: event.params.ticketId, err});
      }
    },
);
