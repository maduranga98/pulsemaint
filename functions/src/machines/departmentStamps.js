/**
 * Department stamps — every work order and breakdown ticket carries its
 * machine's department in `machineDepartment`. firestore.rules confine
 * technician / trainee / supervisor / floor_operator to their own department
 * by that field (rules can't look the machine up for every document of a
 * query), so a record without one would be hidden from them.
 *
 * - stampDepartmentOn*: a record created (or moved to another machine)
 *   without a department gets it from the machine.
 * - propagateMachineDepartment: a machine moved to another department takes
 *   its open work with it (closed history stays where it happened).
 * - backfillDepartmentStamps: one pass over the existing records, resumable,
 *   then idle (state in system/departmentStampBackfill).
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldPath, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

let cachedDb = null;
const getDb = () => (cachedDb = cachedDb || getFirestore("default"));

const DONE_WO = new Set(["COMPLETED", "SIGNED_OFF", "CLOSED", "CANCELLED"]);
const OPEN_BREAKDOWN = new Set([
  "reported", "acknowledged", "triage_in_progress", "assigned", "en_route",
  "repair_in_progress", "on_hold_parts", "on_hold_approval",
]);
const FIELD = "machineDepartment";
const TARGETS = [
  {collection: "workOrders", isOpen: (d) => !DONE_WO.has(String(d.status || ""))},
  {collection: "breakdown_tickets", isOpen: (d) => OPEN_BREAKDOWN.has(String(d.status || ""))},
];

const clean = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Does a record need its department (re)stamped?
 * @param {object|null} before data before the write
 * @param {object|null} after data after the write
 * @return {boolean} true when it has a machine and no department yet, or moved machine
 */
function needsDepartmentStamp(before, after) {
  if (!after || !after.machineId) return false;
  if (!clean(after[FIELD])) return true;
  return !!before && before.machineId !== after.machineId;
}

/**
 * @param {string} machineId machine id
 * @param {string|null} companyId the record's company (cross-company ids are ignored)
 * @return {Promise<string>} the machine's department; "" when unknown
 */
async function machineDepartment(machineId, companyId) {
  const snap = await getDb().collection("machines").doc(String(machineId)).get();
  if (!snap.exists) return "";
  const m = snap.data();
  if (companyId && m.siteId !== companyId && m.companyId !== companyId) return "";
  return clean(m.department);
}

const stampTrigger = ({collection}) => onDocumentWritten(
    {database: "default", document: `${collection}/{id}`},
    async (event) => {
      const before = event.data.before.exists ? event.data.before.data() : null;
      const after = event.data.after.exists ? event.data.after.data() : null;
      if (!needsDepartmentStamp(before, after)) return;
      try {
        const department = await machineDepartment(after.machineId, after.companyId || after.siteId || null);
        if (!department || after[FIELD] === department) return;
        await event.data.after.ref.update({[FIELD]: department});
      } catch (err) {
        logger.error(`stampDepartment (${collection}) failed`, {id: event.params.id, err});
      }
    },
);

exports.stampDepartmentOnWorkOrder = stampTrigger(TARGETS[0]);
exports.stampDepartmentOnBreakdown = stampTrigger(TARGETS[1]);

exports.propagateMachineDepartment = onDocumentWritten(
    {database: "default", document: "machines/{machineId}"},
    async (event) => {
      if (!event.data.before.exists || !event.data.after.exists) return;
      const department = clean(event.data.after.data().department);
      if (clean(event.data.before.data().department) === department || !department) return;
      const machineId = event.params.machineId;
      const companyId = event.data.after.data().siteId || event.data.after.data().companyId;
      const writer = getDb().bulkWriter();
      let moved = 0;
      try {
        for (const target of TARGETS) {
          const snap = await getDb().collection(target.collection).where("machineId", "==", machineId).get();
          snap.docs.forEach((d) => {
            const data = d.data();
            if ((data.companyId || data.siteId) !== companyId) return;
            if (!target.isOpen(data) || data[FIELD] === department) return;
            writer.update(d.ref, {[FIELD]: department});
            moved += 1;
          });
        }
        await writer.close();
        if (moved) logger.info(`propagateMachineDepartment: ${moved} open records of ${machineId} moved to "${department}"`);
      } catch (err) {
        logger.error("propagateMachineDepartment failed", {machineId, err});
      }
    },
);

const BACKFILL_DOC = "system/departmentStampBackfill";
const PAGE = 500;
const TIME_BUDGET_MS = 420 * 1000;

exports.backfillDepartmentStamps = onSchedule(
    {schedule: "every 30 minutes", timeoutSeconds: 540, memory: "512MiB"},
    async () => {
      const db = getDb();
      const stateRef = db.doc(BACKFILL_DOC);
      const state = (await stateRef.get()).data() || {};
      if (state.completedAt) return;
      const cursors = {...(state.cursors || {})};
      const done = {...(state.done || {})};
      const started = Date.now();
      const machineCache = new Map();
      let stamped = 0;

      for (const target of TARGETS) {
        if (done[target.collection]) continue;
        while (Date.now() - started < TIME_BUDGET_MS) {
          let q = db.collection(target.collection).orderBy(FieldPath.documentId()).limit(PAGE);
          if (cursors[target.collection]) q = q.startAfter(cursors[target.collection]);
          const snap = await q.get();
          if (snap.empty) {
            done[target.collection] = true;
            break;
          }
          const missing = snap.docs.filter((d) => d.data().machineId && !clean(d.data()[FIELD]));
          const unknown = [...new Set(missing.map((d) => String(d.data().machineId)))].filter((id) => !machineCache.has(id));
          for (let i = 0; i < unknown.length; i += 100) {
            const refs = unknown.slice(i, i + 100).map((id) => db.collection("machines").doc(id));
            (await db.getAll(...refs)).forEach((m) => machineCache.set(m.id, m.exists ? m.data() : null));
          }
          const batch = db.batch();
          let inBatch = 0;
          missing.forEach((d) => {
            const data = d.data();
            const m = machineCache.get(String(data.machineId));
            const company = data.companyId || data.siteId;
            if (!m || (m.siteId !== company && m.companyId !== company) || !clean(m.department)) return;
            batch.update(d.ref, {[FIELD]: clean(m.department)});
            inBatch += 1;
          });
          if (inBatch) await batch.commit();
          stamped += inBatch;
          cursors[target.collection] = snap.docs[snap.docs.length - 1].id;
          if (snap.size < PAGE) {
            done[target.collection] = true;
            break;
          }
        }
        if (!done[target.collection]) break;
      }

      const allDone = TARGETS.every((t) => done[t.collection]);
      await stateRef.set({
        cursors,
        done,
        stamped: FieldValue.increment(stamped),
        updatedAt: FieldValue.serverTimestamp(),
        ...(allDone ? {completedAt: FieldValue.serverTimestamp()} : {}),
      }, {merge: true});
      logger.info(`backfillDepartmentStamps: stamped ${stamped}${allDone ? " — complete" : ""}`);
    },
);

exports.needsDepartmentStamp = needsDepartmentStamp;
