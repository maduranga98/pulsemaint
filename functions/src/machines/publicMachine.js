const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

const {clientIp, enforceRateLimit} = require("../lib/rateLimit");

const db = getFirestore("default");

const MACHINE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * The few machine details the public QR breakdown page shows
 * (PublicBreakdownReportPage). Anonymous visitors used to read the whole
 * machine document straight from Firestore — cost, supplier, serial and
 * every other field — for any machine id; firestore.rules no longer allow
 * that, and this returns only what the report form needs. No sign-in is
 * needed (the page no longer creates anonymous Auth users); it is
 * rate-limited per address instead.
 */
exports.getPublicMachine = onCall({maxInstances: 30}, async (request) => {
  const machineId = request.data && request.data.machineId;
  if (typeof machineId !== "string" || !MACHINE_ID_PATTERN.test(machineId)) {
    throw new HttpsError("invalid-argument", "machineId is invalid.");
  }
  await enforceRateLimit(`machine:ip:${clientIp(request)}`, 60, 60 * 60 * 1000);
  const snap = await db.collection("machines").doc(machineId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Machine not found.");
  const m = snap.data();
  if (!m.siteId) throw new HttpsError("not-found", "Machine not found.");
  // Only what the form shows — never the company / plant ids (the ticket is
  // filed server-side by submitPublicBreakdown from the machine itself).
  return {
    id: snap.id,
    name: m.name || "Unnamed machine",
    department: typeof m.department === "string" ? m.department : "",
    floor: m.floor ?? null,
    bay: m.bay ?? null,
    station: m.station ?? null,
  };
});
