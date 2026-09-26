const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

// Staff Requests: the work orders and breakdowns a user may pick as the
// subject of a "record_access" request — only finished ones (WOs signed off
// or closed, breakdowns closed) at least 30 days after they were finished —
// from their own plant, and for department-scoped roles only their own
// department's (or ones they were assigned to). The 30-day rule mirrors
// src/lib/recordReferences.ts. Frontline roles can't list workOrders under firestore.rules,
// so the client can't build this itself. Returns only number, machine,
// date and status (via select()), never the record's details — those are
// shared separately by a plant manager / admin through record_access_grants.
// Mirrors src/hooks/useDepartmentScope.ts + useRecordPlantMatcher.ts.

const DEPARTMENT_SCOPED_ROLES = ["technician", "trainee", "supervisor", "floor_operator"];
const MAX_PER_TYPE = 1000;
const MIN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function normDept(v) {
  return String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function millis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}

exports.listRecordReferences = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const db = getFirestore("default");

  const mapping = await db.collection("users").doc(uid).get();
  const companyId = mapping.exists ? mapping.data().companyId : null;
  if (!companyId) throw new HttpsError("failed-precondition", "No company for this user.");

  const meSnap = await db.doc(`companies/${companyId}/users/${uid}`).get();
  if (!meSnap.exists) throw new HttpsError("failed-precondition", "No profile for this user.");
  const me = meSnap.data();
  if (me.role === "admin") return {records: []};

  const siteId = (Array.isArray(me.siteIds) && me.siteIds[0]) || companyId;
  const myPlant = me.plantId || null;
  const myDept = DEPARTMENT_SCOPED_ROLES.includes(me.role) ? normDept(me.department) : "";

  const cutoff = Date.now() - MIN_AGE_MS;
  const [woSnap, bdSnap] = await Promise.all([
    // Uses the existing (siteId, status, createdAt desc) index.
    db.collection("workOrders")
        .where("siteId", "==", siteId)
        .where("status", "in", ["SIGNED_OFF", "CLOSED"])
        .orderBy("createdAt", "desc")
        .limit(MAX_PER_TYPE)
        .select("woNumber", "machineId", "machineName", "machinePlantId", "machineDepartment",
            "assignedTechnicianIds", "supervisorSignOffAt", "closedAt", "updatedAt")
        .get(),
    // Equality filters only - served without a composite index.
    db.collection("breakdown_tickets")
        .where("siteId", "==", siteId)
        .where("status", "==", "closed")
        .limit(MAX_PER_TYPE)
        .select("ticketNumber", "machineId", "machineName", "machinePlantId", "machineDepartment",
            "assignedTechnicianIds", "closedAt", "resolvedAt")
        .get(),
  ]);

  // Older records may lack the stamped plant/department — fall back to the
  // machine's current ones, reading machines only when that's needed.
  const all = [...woSnap.docs, ...bdSnap.docs].map((d) => d.data());
  const needsMachine = all.some((r) => (myPlant && !r.machinePlantId) || (myDept && !r.machineDepartment));
  const machines = new Map();
  if (needsMachine) {
    const mSnap = await db.collection("machines").where("siteId", "==", companyId)
        .select("plantId", "department").get();
    mSnap.docs.forEach((d) => machines.set(d.id, d.data()));
  }

  function inScope(r) {
    const m = r.machineId ? machines.get(r.machineId) : undefined;
    if (myPlant) {
      const plant = r.machinePlantId || (m && m.plantId) || null;
      if (plant !== myPlant) return false;
    }
    if (myDept) {
      if ((r.assignedTechnicianIds || []).includes(uid)) return true;
      const dept = normDept(r.machineDepartment || (m && m.department));
      if (!dept || dept !== myDept) return false;
    }
    return true;
  }

  const records = [];
  woSnap.docs.forEach((d) => {
    const r = d.data();
    const at = millis(r.supervisorSignOffAt) || millis(r.closedAt) || millis(r.updatedAt);
    if (!r.woNumber || !at || at > cutoff || !inScope(r)) return;
    records.push({type: "work_order", id: d.id, number: r.woNumber, machineName: r.machineName || "", at});
  });
  bdSnap.docs.forEach((d) => {
    const r = d.data();
    const at = millis(r.closedAt) || millis(r.resolvedAt);
    if (!r.ticketNumber || !at || at > cutoff || !inScope(r)) return;
    records.push({type: "breakdown", id: d.id, number: r.ticketNumber, machineName: r.machineName || "", at});
  });
  records.sort((a, b) => b.at - a.at);
  return {records};
});
