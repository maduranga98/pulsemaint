/**
 * Deactivated users lose access everywhere, immediately.
 *
 * Marking someone inactive in Settings → Users (or from the platform
 * console) used to only sign them out in the browser — their login still
 * worked and firestore.rules still trusted their role, so anyone with the
 * app (or the Firebase SDK) on any device could keep reading and changing
 * company data. Now, whenever a company profile's status changes:
 *
 *  - the Firebase Auth login (email / password, Google, PIN) is disabled, so
 *    the same email can't sign in again on any device, and every existing
 *    session's refresh token is revoked;
 *  - the users/{uid} role mapping is marked `status: 'inactive'`, which
 *    firestore.rules treat as "no company, no role" — cutting off Firestore
 *    access at once, even for a login token issued before the change;
 *  - reactivating reverses both.
 *
 * The mapping's role / plant / department are also kept equal to the
 * profile here, so access always follows what an admin set on the profile.
 * enforceInactiveUsers re-applies all of this hourly as a safety net (and
 * covers accounts that were already inactive before this was deployed).
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getAuth} = require("firebase-admin/auth");
const {FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {db} = require("../lib/access");

/**
 * Applies a profile's status (and role fields) to the login and mapping.
 * Only touches a login whose mapping belongs to this company (or has none),
 * and never a Lumora superadmin.
 * @param {string} companyId company id
 * @param {string} uid user id
 * @param {object|null} profile company profile data (null = deleted)
 * @return {Promise<void>}
 */
async function applyProfileAccess(companyId, uid, profile) {
  const mappingRef = db.collection("users").doc(uid);
  const mappingSnap = await mappingRef.get();
  const mapping = mappingSnap.exists ? mappingSnap.data() : null;
  // A login that has since moved to another company is not ours to change.
  if (mapping && mapping.companyId && mapping.companyId !== companyId) return;

  if (!profile) {
    // Profile removed: the mapping must no longer grant access. The login
    // itself is left enabled so the person can later accept a new invitation.
    if (mapping) await mappingRef.set({status: "inactive", updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    return;
  }

  const inactive = profile.status === "inactive";
  const wanted = {
    status: inactive ? "inactive" : "active",
    role: profile.role ?? null,
    plantId: profile.plantId ?? null,
    department: profile.department ?? null,
  };
  if (mapping) {
    const changed = Object.keys(wanted).some((k) => (mapping[k] ?? null) !== wanted[k]);
    if (changed) await mappingRef.set({...wanted, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
  } else if (inactive) {
    // No mapping yet — record the block so a later self-heal can't grant access.
    await mappingRef.set({uid, companyId, ...wanted, siteId: companyId}, {merge: true});
  }

  try {
    const user = await getAuth().getUser(uid);
    if (user.customClaims?.superadmin === true) return;
    if (user.disabled !== inactive) {
      await getAuth().updateUser(uid, {disabled: inactive});
      logger.info(inactive ? "Login disabled for deactivated user" : "Login re-enabled for reactivated user", {companyId, uid});
    }
    if (inactive) await getAuth().revokeRefreshTokens(uid);
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err;
  }
}

exports.onCompanyUserWritten = onDocumentWritten(
    {database: "default", document: "companies/{companyId}/users/{uid}"},
    async (event) => {
      const {companyId, uid} = event.params;
      const before = event.data?.before?.exists ? event.data.before.data() : null;
      const after = event.data?.after?.exists ? event.data.after.data() : null;
      const keys = ["status", "role", "plantId", "department"];
      if (before && after && keys.every((k) => (before[k] ?? null) === (after[k] ?? null))) return;
      try {
        await applyProfileAccess(companyId, uid, after);
      } catch (err) {
        logger.error("onCompanyUserWritten access sync failed", {companyId, uid, err});
      }
    },
);

/** Hourly safety net: every inactive profile has a disabled login and an inactive mapping. */
exports.enforceInactiveUsers = onSchedule({schedule: "every 60 minutes", timeoutSeconds: 540}, async () => {
  const companies = await db.collection("companies").select().get();
  let checked = 0;
  for (const company of companies.docs) {
    const inactive = await db.collection(`companies/${company.id}/users`).where("status", "==", "inactive").get();
    for (const profile of inactive.docs) {
      try {
        await applyProfileAccess(company.id, profile.id, profile.data());
        checked += 1;
      } catch (err) {
        logger.error("enforceInactiveUsers failed", {companyId: company.id, uid: profile.id, err});
      }
    }
  }
  logger.info(`enforceInactiveUsers: ${checked} inactive account(s) checked`);
});

exports.applyProfileAccess = applyProfileAccess;
