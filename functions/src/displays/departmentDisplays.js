/**
 * Department display links — a read-only TV / phone board for one department
 * of one plant that anyone with the link can open (no login, no expiry).
 *
 * - listDepartmentDisplays / manageDepartmentDisplay: supervisor, plant_manager
 *   and admin only. A supervisor can share their own department, a plant
 *   manager any department of their plant, an admin any department.
 * - getDepartmentDisplay: public, rate limited. The long random token is the
 *   document id; "stop sharing" turns it off at once, "new link" replaces it.
 *   It returns only what the floor needs — machine names, a status and
 *   times. Never what happened, people, costs, parts, notes or files.
 *
 * `departmentDisplays` is server-only (firestore.rules deny every client read
 * and write); it is also in TENANT_COLLECTIONS so closing a company erases it.
 */

const crypto = require("crypto");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const {getDb, requireOwnCompany} = require("../lib/access");
const {clientIp, enforceRateLimit} = require("../lib/rateLimit");
const logic = require("./displayLogic");

const MANAGE_ROLES = ["supervisor", "plant_manager", "admin"];
// Same codes as src/lib/supportedLanguages.ts.
const LANGUAGES = ["en-US", "si", "ta", "es", "fr", "de", "zh", "ja"];
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const newToken = () => crypto.randomBytes(24).toString("base64url");

/**
 * Which (plant, department) pairs the caller may share.
 * @param {object} user the caller's users/{uid} mapping
 * @return {Promise<{plantId:string,name:string}[]>} allowed departments
 */
async function allowedDepartments(user) {
  const db = getDb();
  if (user.role === "supervisor") {
    const name = clean(user.department);
    return name && user.plantId ? [{plantId: user.plantId, name}] : [];
  }
  let q = db.collection("departments").where("companyId", "==", user.companyId);
  if (user.role === "plant_manager" && user.plantId) q = q.where("plantId", "==", user.plantId);
  const snap = await q.get();
  const seen = new Set();
  const out = [];
  for (const d of snap.docs) {
    const name = clean(d.get("name"));
    const plantId = d.get("plantId");
    if (!name || !plantId) continue;
    const key = `${plantId}\u0000${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({plantId, name});
  }
  return out;
}

const shape = (id, d) => ({token: id, enabled: !!d.enabled, language: d.language || "en-US"});

/** Lists the departments the caller can share, with their current link (if any). */
exports.listDepartmentDisplays = onCall({maxInstances: 10}, async (request) => {
  const user = await requireOwnCompany(request, {roles: MANAGE_ROLES});
  const db = getDb();
  const allowed = await allowedDepartments(user);
  const [displays, plants] = await Promise.all([
    db.collection("departmentDisplays").where("companyId", "==", user.companyId).get(),
    db.collection("plants").where("companyId", "==", user.companyId).get().catch(() => ({docs: []})),
  ]);
  const plantNames = new Map(plants.docs.map((p) => [p.id, clean(p.get("name")) || p.id]));
  const byKey = new Map();
  for (const d of displays.docs) byKey.set(`${d.get("plantId")}\u0000${d.get("department")}`, d);
  const departments = allowed.map((a) => {
    const d = byKey.get(`${a.plantId}\u0000${a.name}`);
    return {
      plantId: a.plantId,
      plantName: plantNames.get(a.plantId) || "",
      name: a.name,
      display: d ? shape(d.id, d.data()) : null,
    };
  }).sort((x, y) => x.plantName.localeCompare(y.plantName) || x.name.localeCompare(y.name));
  return {departments};
});

/**
 * start (create or turn back on, same link), stop, regenerate (new link, the
 * old one stops working) or setLanguage for one department.
 */
exports.manageDepartmentDisplay = onCall({maxInstances: 10}, async (request) => {
  const user = await requireOwnCompany(request, {roles: MANAGE_ROLES});
  const data = request.data || {};
  const action = data.action;
  const department = clean(data.department);
  const plantId = clean(data.plantId);
  if (!["start", "stop", "regenerate", "setLanguage"].includes(action)) {
    throw new HttpsError("invalid-argument", "Unknown action.");
  }
  if (!department || !plantId) throw new HttpsError("invalid-argument", "Department and plant are required.");
  const allowed = await allowedDepartments(user);
  if (!allowed.some((a) => a.plantId === plantId && a.name === department)) {
    throw new HttpsError("permission-denied", "You cannot share this department.");
  }
  const language = LANGUAGES.includes(data.language) ? data.language : null;
  if (action === "setLanguage" && !language) throw new HttpsError("invalid-argument", "Unsupported language.");

  const db = getDb();
  const col = db.collection("departmentDisplays");
  const existing = await col
      .where("companyId", "==", user.companyId).where("plantId", "==", plantId).where("department", "==", department)
      .limit(1).get();
  const cur = existing.empty ? null : existing.docs[0];

  if (action === "start") {
    if (cur) {
      await cur.ref.update({enabled: true, ...(language ? {language} : {}), updatedAt: FieldValue.serverTimestamp()});
      return {display: shape(cur.id, {...cur.data(), enabled: true, ...(language ? {language} : {})})};
    }
    const token = newToken();
    const doc = {
      companyId: user.companyId, plantId, department, enabled: true, language: language || "en-US",
      createdBy: user.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    await col.doc(token).set(doc);
    return {display: shape(token, doc)};
  }
  if (!cur) throw new HttpsError("not-found", "This department is not shared yet.");
  if (action === "stop") {
    await cur.ref.update({enabled: false, updatedAt: FieldValue.serverTimestamp()});
    return {display: shape(cur.id, {...cur.data(), enabled: false})};
  }
  if (action === "setLanguage") {
    await cur.ref.update({language, updatedAt: FieldValue.serverTimestamp()});
    return {display: shape(cur.id, {...cur.data(), language})};
  }
  // regenerate: a new token; the old link stops working immediately.
  const token = newToken();
  const old = cur.data();
  const doc = {
    companyId: user.companyId, plantId, department, enabled: true, language: old.language || "en-US",
    createdBy: user.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = db.batch();
  batch.set(col.doc(token), doc);
  batch.delete(cur.ref);
  await batch.commit();
  return {display: shape(token, doc)};
});

/** Public: the board data for a token. Off / unknown / replaced links all answer `enabled: false`. */
exports.getDepartmentDisplay = onCall({maxInstances: 40}, async (request) => {
  const data = request.data || {};
  const token = data.token;
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw new HttpsError("invalid-argument", "This link is not valid.");
  }
  // A screen polls every 30 s (120 / hour); a factory can have many screens behind one address.
  await enforceRateLimit(`display:ip:${clientIp(request)}:${token}`, 3000, 60 * 60 * 1000);
  await enforceRateLimit(`display:token:${token}`, 20000, 60 * 60 * 1000);

  const db = getDb();
  const snap = await db.collection("departmentDisplays").doc(token).get();
  if (!snap.exists || !snap.get("enabled")) return {enabled: false};
  const link = snap.data();
  const {companyId, plantId, department} = link;

  const now = Date.now();
  const win = logic.dayWindow(now, data.dayStartMs, data.dayEndMs);
  const [tickets, closed, workOrders, pm, plant] = await Promise.all([
    db.collection("breakdown_tickets")
        .where("siteId", "==", companyId).where("machineDepartment", "==", department)
        .where("status", "in", logic.BREAKDOWN_QUERY_STATUSES).get(),
    // Breakdowns signed off today. A failure here (e.g. its index is still building) only empties the Completed tab.
    db.collection("breakdown_tickets")
        .where("siteId", "==", companyId).where("machineDepartment", "==", department)
        .where("status", "==", "closed").where("closedAt", ">=", Timestamp.fromMillis(win.start)).get()
        .catch((err) => {
          logger.warn("display: completed breakdowns not loaded", {err: String(err && err.message ? err.message : err).slice(0, 300)});
          return {docs: []};
        }),
    db.collection("workOrders")
        .where("siteId", "==", companyId).where("machineDepartment", "==", department)
        .where("status", "in", logic.WO_QUERY_STATUSES).get(),
    db.collection("pm_schedules")
        .where("companyId", "==", companyId).where("department", "==", department)
        .where("status", "==", "active").get(),
    db.collection("plants").doc(String(plantId)).get(),
  ]);
  const payload = logic.buildDisplayPayload({
    now, win, plantId,
    tickets: tickets.docs.map((d) => d.data()),
    closedTickets: closed.docs.map((d) => d.data()),
    workOrders: workOrders.docs.map((d) => d.data()),
    pmSchedules: pm.docs.map((d) => d.data()),
  });
  return {
    enabled: true,
    department,
    plantName: plant.exists ? clean(plant.get("name")) : "",
    language: link.language || "en-US",
    now,
    ...payload,
  };
});
