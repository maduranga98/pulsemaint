const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Mirrors src/lib/notifications/recipients.ts (OVERSIGHT_ROLES) — kept in
// sync by hand since Cloud Functions doesn't share code with the client.
const OVERSIGHT_ROLES = ["admin", "plant_manager"];

const TECHNICIAN_ROLES = ["technician"];
const SUPERVISOR_ROLES = ["supervisor", "maintenance_supervisor"];

// Department names compared the way people read them — case and spacing
// don't matter. Mirrors sameDepartment() in src/hooks/useRecordPlantMatcher.ts.
function normDepartment(v) {
  return String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Who should hear about a new breakdown on a machine: the technicians
 * registered to the machine's department, and the supervisors of that
 * department who are on shift right now (a supervisor who hasn't clocked in
 * can't act on it). A machine with no department / plant alerts the whole
 * plant / company for that role.
 *
 * @param {Array<{id: string, role: string, department?: string, plantId?: string}>} users company users
 * @param {Set<string>} onShiftUserIds users with an active shift session
 * @param {{plantId?: string|null, department?: string|null}} machine the breakdown's machine
 * @return {{technicianIds: string[], supervisorIds: string[]}} recipients
 */
function pickAlertRecipients(users, onShiftUserIds, machine) {
  const dept = normDepartment(machine.department);
  const inScope = (u) =>
    (!machine.plantId || u.plantId === machine.plantId) &&
    (!dept || normDepartment(u.department) === dept);
  const scoped = users.filter(inScope);
  return {
    technicianIds: scoped.filter((u) => TECHNICIAN_ROLES.includes(u.role)).map((u) => u.id),
    supervisorIds: scoped
        .filter((u) => SUPERVISOR_ROLES.includes(u.role) && onShiftUserIds.has(u.id))
        .map((u) => u.id),
  };
}

exports.pickAlertRecipients = pickAlertRecipients;

// Written server-side (not by the reporting client) so it fires the same way
// for every source — a floor operator, a technician, or an anonymous QR scan —
// and can see who is on shift, which the reporter's own login can't read.
exports.notifyBreakdownReported = onDocumentCreated(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    async (event) => {
      const ticket = event.data && event.data.data();
      if (!ticket || ticket.status !== "reported") return;
      try {
        const machineSnap = ticket.machineId ?
          await db.collection("machines").doc(String(ticket.machineId)).get() : null;
        const machine = machineSnap && machineSnap.exists ? machineSnap.data() : {};
        const companyId = machine.companyId || ticket.companyId || ticket.siteId;
        if (!companyId) return;

        const plantId = ticket.machinePlantId || machine.plantId || null;
        const department = ticket.machineDepartment || machine.department || null;

        const [usersSnap, shiftSnap] = await Promise.all([
          db.collection("users").where("companyId", "==", companyId)
              .where("role", "in", [...TECHNICIAN_ROLES, ...SUPERVISOR_ROLES]).get(),
          db.collection("shift_sessions").where("companyId", "==", companyId)
              .where("status", "==", "active").get(),
        ]);
        const users = usersSnap.docs.map((d) => ({id: d.id, ...d.data()}));
        const onShift = new Set(shiftSnap.docs.map((d) => d.data().userId));
        const {technicianIds, supervisorIds} = pickAlertRecipients(users, onShift, {plantId, department});
        const recipientUserIds = Array.from(new Set([...technicianIds, ...supervisorIds]));

        const machineName = ticket.machineName || machine.name || "A machine";
        await db.collection("notifications").add({
          companyId,
          type: "breakdown",
          message: `${machineName}: new breakdown reported${ticket.machineStillRunning ? " (still running, degraded)" : ""}`,
          oversightMessage: `New breakdown reported on ${machineName}`,
          severity: "medium",
          linkTo: "/app/breakdowns",
          timestamp: FieldValue.serverTimestamp(),
          read: false,
          readBy: [],
          // Plant leadership is copied on everything, as the app does for
          // every targeted notification.
          recipientRoles: OVERSIGHT_ROLES,
          recipientUserIds,
          targetRoles: OVERSIGHT_ROLES,
          targetUserIds: recipientUserIds,
          actorName: null,
          actorRole: null,
          actorUserId: null,
          plantId,
          department: department || null,
        });
        logger.info("Breakdown alert sent", {
          ticketId: event.params.ticketId,
          technicians: technicianIds.length,
          supervisors: supervisorIds.length,
        });
      } catch (err) {
        logger.error("notifyBreakdownReported failed", {ticketId: event.params.ticketId, err});
      }
    },
);
