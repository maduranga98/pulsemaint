/**
 * costWorkOrder — fills in a finished work order's real costs.
 *
 * Maintenance cost on the dashboards is parts + labour + contractor
 * invoices, but labour was always 0 (no work log carried a cost) and parts
 * added by a team completion were recorded at cost 0. When a work order is
 * done (completed / signed off / closed) — or its parts or work logs change
 * afterwards — this:
 *  - prices every used part that has no cost from the part's inventory unit
 *    cost (inventoryParts/{partId}.unitCost);
 *  - costs each technician's logged hours at their labour rate
 *    (companies/{companyId}/labourRates/{uid}.hourlyRate, set by admin / HR
 *    on the Users page and readable only by management);
 *  - stores totalPartsCost, totalLaborCost and laborCostComplete (false when
 *    someone's rate isn't set, so the labour figure is a floor).
 * It only writes when something changed, so its own update doesn't loop.
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Opened on first use, so the pure helpers below can be unit-tested.
let cachedDb = null;
const getDb = () => (cachedDb = cachedDb || getFirestore("default"));
const DONE = new Set(["COMPLETED", "SIGNED_OFF", "CLOSED"]);

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} wo work order data
 * @param {Map<string, number>} unitCosts partId → inventory unit cost
 * @param {Map<string, number>} rates uid → hourly rate
 * @return {{partsUsed: object[], technicianWorkLogs: object[], totalPartsCost: number,
 *   totalLaborCost: number, laborCostComplete: boolean}} costed fields
 */
function costFields(wo, unitCosts, rates) {
  const partsUsed = (Array.isArray(wo.partsUsed) ? wo.partsUsed : []).map((p) => {
    const qty = Number(p.quantity) || 0;
    let unitCost = Number(p.unitCost) || 0;
    if (!(unitCost > 0) && p.partId && unitCosts.has(String(p.partId))) unitCost = unitCosts.get(String(p.partId));
    const totalCost = Number(p.totalCost) > 0 ? Number(p.totalCost) : round2(qty * unitCost);
    return {...p, unitCost, totalCost};
  });
  let laborCostComplete = true;
  const technicianWorkLogs = (Array.isArray(wo.technicianWorkLogs) ? wo.technicianWorkLogs : []).map((l) => {
    const hours = Number(l.hoursWorked) || 0;
    const rate = l.technicianId ? rates.get(String(l.technicianId)) : undefined;
    if (hours > 0 && !(rate > 0)) laborCostComplete = false;
    return {...l, laborRate: rate > 0 ? rate : null, laborCost: rate > 0 ? round2(hours * rate) : null};
  });
  return {
    partsUsed,
    technicianWorkLogs,
    totalPartsCost: round2(partsUsed.reduce((s, p) => s + (Number(p.totalCost) || 0), 0)),
    totalLaborCost: round2(technicianWorkLogs.reduce((s, l) => s + (Number(l.laborCost) || 0), 0)),
    laborCostComplete,
  };
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

exports.costWorkOrder = onDocumentWritten(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      if (!event.data.after.exists) return;
      const after = event.data.after.data();
      if (!DONE.has(after.status)) return;
      const before = event.data.before.exists ? event.data.before.data() : {};
      const firstDone = !DONE.has(before.status);
      const inputsChanged = !same(before.partsUsed, after.partsUsed) || !same(before.technicianWorkLogs, after.technicianWorkLogs);
      if (!firstDone && !inputsChanged) return;
      const companyId = after.companyId || after.siteId;
      if (!companyId) return;

      try {
        const partIds = [...new Set((after.partsUsed || [])
            .filter((p) => p.partId && !(Number(p.unitCost) > 0))
            .map((p) => String(p.partId)))];
        const techIds = [...new Set((after.technicianWorkLogs || []).map((l) => l.technicianId).filter(Boolean).map(String))];
        const [partSnaps, rateSnaps] = await Promise.all([
          partIds.length ? getDb().getAll(...partIds.map((id) => getDb().collection("inventoryParts").doc(id))) : [],
          techIds.length ? getDb().getAll(...techIds.map((id) => getDb().doc(`companies/${companyId}/labourRates/${id}`))) : [],
        ]);
        const unitCosts = new Map();
        partSnaps.forEach((s) => {
          // Only the company's own parts.
          if (s.exists && (s.data().companyId === companyId) && Number(s.data().unitCost) > 0) {
            unitCosts.set(s.id, Number(s.data().unitCost));
          }
        });
        const rates = new Map();
        rateSnaps.forEach((s) => {
          if (s.exists && Number(s.data().hourlyRate) > 0) rates.set(s.id, Number(s.data().hourlyRate));
        });

        const next = costFields(after, unitCosts, rates);
        const changed = Object.keys(next).some((k) => !same(after[k], next[k]));
        if (!changed) return;
        await event.data.after.ref.update(next);
      } catch (err) {
        logger.error("costWorkOrder failed", {woId: event.params.woId, err});
      }
    },
);

exports.costFields = costFields;
