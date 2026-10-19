const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore("default");

const MACHINE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * The few machine details the public QR breakdown page shows
 * (PublicBreakdownReportPage). Anonymous visitors used to read the whole
 * machine document straight from Firestore — cost, supplier, serial and
 * every other field — for any machine id; firestore.rules no longer allow
 * that, and this returns only what the report form needs.
 */
exports.getPublicMachine = onCall({maxInstances: 30}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Open the page from the machine's QR code.");
  const machineId = request.data && request.data.machineId;
  if (typeof machineId !== "string" || !MACHINE_ID_PATTERN.test(machineId)) {
    throw new HttpsError("invalid-argument", "machineId is invalid.");
  }
  const snap = await db.collection("machines").doc(machineId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Machine not found.");
  const m = snap.data();
  if (!m.siteId) throw new HttpsError("not-found", "Machine not found.");
  return {
    id: snap.id,
    name: m.name || "Unnamed machine",
    department: typeof m.department === "string" ? m.department : "",
    plantId: m.plantId || null,
    floor: m.floor ?? null,
    bay: m.bay ?? null,
    station: m.station ?? null,
    criticality: Number.isInteger(m.criticality) ? m.criticality : null,
    siteId: m.siteId,
  };
});
