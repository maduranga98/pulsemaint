const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

// Staff Requests: the people the signed-in user may send a request to —
// supervisors of their own plant + department, plant managers of their own
// plant, and the company's admins (narrowed to the roles the caller's own
// role may address). Frontline roles (technician, trainee, floor operator)
// can't read the company user roster under firestore.rules, so the client
// can't build this list itself; this returns only name / role / department /
// plant — never phone, address or other profile fields.

const RECIPIENT_ROLES = {
  plant_manager: ["admin"],
  supervisor: ["plant_manager", "admin"],
};
const DEFAULT_RECIPIENT_ROLES = ["supervisor", "plant_manager", "admin"];

function normDept(v) {
  return String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
}

exports.listRequestRecipients = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const db = getFirestore("default");

  const mapping = await db.collection("users").doc(uid).get();
  const companyId = mapping.exists ? mapping.data().companyId : null;
  if (!companyId) throw new HttpsError("failed-precondition", "No company for this user.");

  const meSnap = await db.doc(`companies/${companyId}/users/${uid}`).get();
  if (!meSnap.exists) throw new HttpsError("failed-precondition", "No profile for this user.");
  const me = meSnap.data();
  if (me.role === "admin") return {recipients: []};

  const allowed = RECIPIENT_ROLES[me.role] || DEFAULT_RECIPIENT_ROLES;
  const snap = await db
      .collection(`companies/${companyId}/users`)
      .where("role", "in", allowed)
      .get();

  const myPlant = me.plantId || null;
  const myDept = normDept(me.department);
  const recipients = snap.docs
      .filter((d) => d.id !== uid)
      .map((d) => ({id: d.id, ...d.data()}))
      .filter((u) => u.status !== "inactive")
      .filter((u) => {
        if (u.role === "admin") return true;
        if ((u.plantId || null) !== myPlant) return false;
        return u.role === "plant_manager" || (myDept && normDept(u.department) === myDept);
      })
      .map((u) => ({
        id: u.id,
        fullName: u.fullName || "",
        role: u.role,
        department: u.department || null,
        plantId: u.plantId || null,
      }));

  return {recipients};
});
