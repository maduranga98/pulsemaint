/**
 * Plant stamps — every machine-linked record carries its machine's plant:
 *   workOrders / breakdown_tickets / pm_history  → machinePlantId
 *   pm_schedules                                 → plantId
 * firestore.rules limit plant-scoped roles to their own plant by these
 * fields (rules can't look the machine up for every document of a query),
 * so a record without one would be invisible — or, before the rules, leak.
 *
 * - stampPlantOn*: a record created (or moved to another machine) without
 *   the right plant gets it from the machine.
 * - propagateMachinePlant: a machine moved to another plant takes its open
 *   work with it (closed history stays with the plant where it happened).
 * - backfillPlantStamps: one pass over the existing records, resumable,
 *   then idle (state in system/plantStampBackfill).
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldPath, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Opened on first use, so the pure helpers can be unit-tested.
let cachedDb = null;
const getDb = () => (cachedDb = cachedDb || getFirestore("default"));

const DONE_WO = new Set(["COMPLETED", "SIGNED_OFF", "CLOSED", "CANCELLED"]);
const OPEN_BREAKDOWN = new Set([
  "reported", "acknowledged", "triage_in_progress", "assigned", "en_route",
  "repair_in_progress", "on_hold_parts", "on_hold_approval",
]);

const TARGETS = [
  {collection: "workOrders", field: "machinePlantId", isOpen: (d) => !DONE_WO.has(String(d.status || ""))},
  {collection: "breakdown_tickets", field: "machinePlantId", isOpen: (d) => OPEN_BREAKDOWN.has(String(d.status || ""))},
  {collection: "pm_schedules", field: "plantId", isOpen: (d) => !["completed", "archived"].includes(String(d.status || ""))},
  {collection: "pm_history", field: "machinePlantId", isOpen: (d) => ["in_progress", "overdue"].includes(String(d.status || ""))},
];

/**
 * Does a record need its plant (re)stamped?
 * @param {object|null} before data before the write
 * @param {object|null} after data after the write
 * @param {string} field plant field
 * @return {boolean} true when it has a machine and no plant key yet, or moved machine
 */
function needsStamp(before, after, field) {
  if (!after || !after.machineId) return false;
  if (!Object.prototype.hasOwnProperty.call(after, field)) return true;
  return !!before && before.machineId !== after.machineId;
}

/**
 * @param {string} machineId machine id
 * @param {string|null} companyId the record's company (cross-company ids are ignored)
 * @return {Promise<string|null|undefined>} the machine's plant; undefined when unknown
 */
async function machinePlant(machineId, companyId) {
  const snap = await getDb().collection("machines").doc(String(machineId)).get();
  if (!snap.exists) return undefined;
  const m = snap.data();
  if (companyId && m.siteId !== companyId && m.companyId !== companyId) return undefined;
  return m.plantId || null;
}

const stampTrigger = ({collection, field}) => onDocumentWritten(
    {database: "default", document: `${collection}/{id}`},
    async (event) => {
      const before = event.data.before.exists ? event.data.before.data() : null;
      const after = event.data.after.exists ? event.data.after.data() : null;
      if (!needsStamp(before, after, field)) return;
      try {
        const plant = await machinePlant(after.machineId, after.companyId || after.siteId || null);
        if (plant === undefined) {
          // Unknown machine: still record "no plant" so the key exists.
          if (!Object.prototype.hasOwnProperty.call(after, field)) await event.data.after.ref.update({[field]: null});
          return;
        }
        if (after[field] === plant && Object.prototype.hasOwnProperty.call(after, field)) return;
        await event.data.after.ref.update({[field]: plant});
      } catch (err) {
        logger.error(`stampPlant (${collection}) failed`, {id: event.params.id, err});
      }
    },
);

exports.stampPlantOnWorkOrder = stampTrigger(TARGETS[0]);
exports.stampPlantOnBreakdown = stampTrigger(TARGETS[1]);
exports.stampPlantOnPmSchedule = stampTrigger(TARGETS[2]);
exports.stampPlantOnPmHistory = stampTrigger(TARGETS[3]);

exports.propagateMachinePlant = onDocumentWritten(
    {database: "default", document: "machines/{machineId}"},
    async (event) => {
      if (!event.data.before.exists || !event.data.after.exists) return;
      const before = event.data.before.data();
      const after = event.data.after.data();
      const plant = after.plantId || null;
      if ((before.plantId || null) === plant) return;
      const machineId = event.params.machineId;
      const companyId = after.siteId || after.companyId;
      const writer = getDb().bulkWriter();
      let moved = 0;
      try {
        for (const target of TARGETS) {
          const snap = await getDb().collection(target.collection).where("machineId", "==", machineId).get();
          snap.docs.forEach((d) => {
            const data = d.data();
            if ((data.companyId || data.siteId) !== companyId) return;
            if (!target.isOpen(data) || data[target.field] === plant) return;
            writer.update(d.ref, {[target.field]: plant});
            moved += 1;
          });
        }
        await writer.close();
        if (moved) logger.info(`propagateMachinePlant: ${moved} open records of ${machineId} moved to plant ${plant}`);
      } catch (err) {
        logger.error("propagateMachinePlant failed", {machineId, err});
      }
    },
);

const BACKFILL_DOC = "system/plantStampBackfill";
const PAGE = 500;
const TIME_BUDGET_MS = 420 * 1000;

exports.backfillPlantStamps = onSchedule(
    {schedule: "every 30 minutes", timeoutSeconds: 540, memory: "512MiB"},
    async () => {
      const db = getDb();
      const stateRef = db.doc(BACKFILL_DOC);
      const state = (await stateRef.get()).data() || {};
      if (state.completedAt) return;
      const cursors = {...(state.cursors || {})};
      const done = {...(state.done || {})};
      const started = Date.now();
      const plantCache = new Map();
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
          const missing = snap.docs.filter((d) => {
            const data = d.data();
            return data.machineId && !Object.prototype.hasOwnProperty.call(data, target.field);
          });
          const unknown = [...new Set(missing.map((d) => String(d.data().machineId)))].filter((id) => !plantCache.has(id));
          for (let i = 0; i < unknown.length; i += 100) {
            const refs = unknown.slice(i, i + 100).map((id) => db.collection("machines").doc(id));
            (await db.getAll(...refs)).forEach((m) => plantCache.set(m.id, m.exists ? m.data() : null));
          }
          const batch = db.batch();
          missing.forEach((d) => {
            const data = d.data();
            const m = plantCache.get(String(data.machineId));
            const company = data.companyId || data.siteId;
            const sameCompany = m && (m.siteId === company || m.companyId === company);
            batch.update(d.ref, {[target.field]: sameCompany ? (m.plantId || null) : null});
          });
          if (missing.length) await batch.commit();
          stamped += missing.length;
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
      logger.info(`backfillPlantStamps: stamped ${stamped}${allDone ? " — complete" : ""}`);
    },
);

exports.needsStamp = needsStamp;
exports.PLANT_TARGETS = TARGETS;
