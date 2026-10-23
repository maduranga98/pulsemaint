const crypto = require("crypto");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {clientIp, enforceRateLimit} = require("../lib/rateLimit");

const db = getFirestore("default");

const MACHINE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TICKET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HOUR = 60 * 60 * 1000;

/** `BD-<year>-<6 random characters>`, same shape the client used to build. */
function newTicketNumber() {
  const bytes = crypto.randomBytes(6);
  const suffix = Array.from(bytes, (b) => TICKET_ALPHABET[b % TICKET_ALPHABET.length]).join("");
  return `BD-${new Date().getFullYear()}-${suffix}`;
}

/**
 * Public, no-login breakdown report from a machine's QR code. Replaces the
 * old flow that signed every visitor in anonymously (one Firebase Auth user
 * per scan) so it could write to Firestore directly: this callable takes
 * no sign-in, validates the input, takes the company / plant / department
 * from the machine itself (never from the caller) and writes the ticket
 * with admin rights. Rate-limited per address + machine, per machine and
 * per address, so a printed QR code can't be used to flood a queue.
 */
exports.submitPublicBreakdown = onCall({maxInstances: 20}, async (request) => {
  const {machineId, description, machineStillRunning} = request.data || {};
  if (typeof machineId !== "string" || !MACHINE_ID_PATTERN.test(machineId)) {
    throw new HttpsError("invalid-argument", "machineId is invalid.");
  }
  const text = typeof description === "string" ? description.trim() : "";
  if (text.length < 10 || text.length > 5000) {
    throw new HttpsError("invalid-argument", "Describe the breakdown in 10 to 5000 characters.");
  }

  const ip = clientIp(request);
  await enforceRateLimit(`report:ip-machine:${ip}:${machineId}`, 5, HOUR / 6);
  await enforceRateLimit(`report:machine:${machineId}`, 30, HOUR);
  await enforceRateLimit(`report:ip:${ip}`, 20, HOUR);

  const snap = await db.collection("machines").doc(machineId).get();
  const m = snap.exists ? snap.data() : null;
  if (!m || !m.siteId) throw new HttpsError("not-found", "Machine not found. The QR code may be out of date.");

  const ticketNumber = newTicketNumber();
  const location = [m.floor && `Floor ${m.floor}`, m.bay && `Bay ${m.bay}`, m.station && `Station ${m.station}`]
      .filter(Boolean).join(" · ");
  await db.collection("breakdown_tickets").add({
    ticketNumber,
    siteId: m.siteId,
    companyId: m.siteId,
    machineId: snap.id,
    machineName: m.name || "Unnamed machine",
    machineDepartment: typeof m.department === "string" ? m.department : "",
    machinePlantId: m.plantId || null,
    machineLocation: location,
    machineCriticality: Number.isInteger(m.criticality) ? m.criticality : 3,
    severity: null,
    type: null,
    description: text,
    productionImpact: "",
    currentProductionCount: null,
    attemptedFixes: "",
    machineStillRunning: machineStillRunning === true,
    photos: [],
    video: null,
    source: "qr_scan",
    reportedBy: null,
    reporterName: null,
    reporterRole: null,
    reportedAt: FieldValue.serverTimestamp(),
    status: "reported",
    statusHistory: [],
    assignedTechnicianIds: [],
    assignedTechnicianNames: [],
    assignedContractorId: null,
    assignedBy: null,
    assignedByName: null,
    attendedBy: null,
    attendedByName: null,
    attendedAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    assignedAt: null,
    enRouteAt: null,
    repairStartedAt: null,
    resolvedAt: null,
    closedAt: null,
    slaDeadline: null,
  });
  return {ticketNumber};
});
