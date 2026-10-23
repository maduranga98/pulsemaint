/**
 * deleteCompanyUser — an admin removes a team member's login and personal data.
 *
 * Admin of the same company only (never yourself, never the last admin, never
 * a Lumora superadmin, never an account that now belongs to another company).
 * Removes the Firebase Auth login (so the email can no longer sign in), the
 * users/{uid} role mapping, the company profile, the labour rate, the live
 * technician status and the person's own pending invitations. Work records
 * (work orders, breakdowns, sign-offs …) keep the person's name as written
 * at the time so history and audits stay intact.
 *
 * The profile deletion reaches every open Users list, shift roster and
 * assignment picker through their Firestore listeners.
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const {db, requireMember} = require("../lib/access");

exports.deleteCompanyUser = onCall({cors: true}, async (request) => {
  const uid = request.data?.uid;
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "uid is required.");
  const caller = await requireOwnCompanyAdmin(request);
  const companyId = caller.companyId;
  if (uid === caller.uid) throw new HttpsError("failed-precondition", "You cannot delete your own account.");

  const profileRef = db.doc(`companies/${companyId}/users/${uid}`);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) throw new HttpsError("not-found", "That user is not in your company.");
  const profile = profileSnap.data();

  if (profile.role === "admin") {
    const admins = await db.collection(`companies/${companyId}/users`).where("role", "==", "admin").get();
    const others = admins.docs.filter((d) => d.id !== uid && d.get("status") !== "inactive");
    if (others.length === 0) throw new HttpsError("failed-precondition", "The last admin cannot be deleted.");
  }

  const mappingRef = db.collection("users").doc(uid);
  const mappingSnap = await mappingRef.get();
  const mappingCompany = mappingSnap.exists ? mappingSnap.get("companyId") : null;
  const ownsLogin = !mappingCompany || mappingCompany === companyId;

  if (ownsLogin) {
    try {
      const user = await getAuth().getUser(uid);
      if (user.customClaims?.superadmin === true) {
        throw new HttpsError("permission-denied", "A platform account cannot be deleted here.");
      }
      await getAuth().deleteUser(uid);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (err?.code !== "auth/user-not-found") throw err;
    }
    if (mappingSnap.exists) await mappingRef.delete();
  }

  const batch = db.batch();
  batch.delete(profileRef);
  batch.delete(db.doc(`companies/${companyId}/labourRates/${uid}`));
  batch.delete(db.collection("technician_status").doc(`${companyId}_${uid}`));
  await batch.commit();

  // Their own unaccepted invitations (by email) would otherwise let the same
  // address register again without the admin noticing.
  const email = (profile.email || "").toLowerCase();
  if (email) {
    const invites = await db.collection(`companies/${companyId}/invitations`)
        .where("email", "==", email).get();
    await Promise.all(invites.docs.filter((d) => d.get("status") === "pending").map((d) => d.ref.delete()));
  }

  logger.info("Company user deleted", {companyId, uid, by: caller.uid});
  return {ok: true};
});

/**
 * Caller must be an active admin of their own company.
 * @param {object} request the callable request
 * @return {Promise<object>} the caller's mapping (+ uid)
 */
async function requireOwnCompanyAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const snap = await db.collection("users").doc(request.auth.uid).get();
  const companyId = snap.exists ? snap.get("companyId") : null;
  return requireMember(request, companyId, {roles: ["admin"]});
}
