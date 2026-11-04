const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

// Staff Requests: the people the signed-in user may send a request to — see
// recipientRules.js (supervisors may also address supervisors of other
// departments in their plant). Frontline roles (technician, trainee, floor operator)
// can't read the company user roster under firestore.rules, so the client
// can't build this list itself; this returns only name / role / department /
// plant — never phone, address or other profile fields.

const {RECIPIENT_ROLES, DEFAULT_RECIPIENT_ROLES, canAddress} = require("./recipientRules");

exports.listRequestRecipients = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;
  const db = getFirestore("default");

  const mapping = await db.collection("users").doc(uid).get();
  const companyId = mapping.exists ? mapping.data().companyId : null;
  if (!companyId) throw new HttpsError("failed-precondition", "No company for this user.");
  if (mapping.data().status === "inactive") throw new HttpsError("permission-denied", "Your account has been deactivated.");

  const meSnap = await db.doc(`companies/${companyId}/users/${uid}`).get();
  if (!meSnap.exists) throw new HttpsError("failed-precondition", "No profile for this user.");
  const me = meSnap.data();
  if (me.role === "admin") return {recipients: []};

  const allowed = RECIPIENT_ROLES[me.role] || DEFAULT_RECIPIENT_ROLES;
  const snap = await db
      .collection(`companies/${companyId}/users`)
      .where("role", "in", allowed)
      .get();

  const sender = {id: uid, role: me.role, plantId: me.plantId || null, department: me.department || null};
  const recipients = snap.docs
      .map((d) => ({id: d.id, ...d.data()}))
      .filter((u) => canAddress(sender, u))
      .map((u) => ({
        id: u.id,
        fullName: u.fullName || "",
        role: u.role,
        department: u.department || null,
        plantId: u.plantId || null,
      }));

  return {recipients};
});
