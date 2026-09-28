const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue } = require("firebase-admin/firestore");
const { db, bootstrapSuperadminEmails, audit } = require("./platformAccess");

async function setClaim(uid, enabled) {
  const user = await getAuth().getUser(uid);
  const claims = { ...(user.customClaims || {}) };
  if (enabled) claims.superadmin = true;
  else delete claims.superadmin;
  await getAuth().setCustomUserClaims(uid, claims);
  const ref = db.collection("platformAdmins").doc(uid);
  if (enabled) {
    await ref.set({ uid, email: user.email ?? null, name: user.displayName ?? null, grantedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await ref.delete();
  }
  return user;
}

/**
 * Bootstrap: a signed-in account whose verified email is listed in
 * PLATFORM_SUPERADMIN_EMAILS (functions/.env) turns on superadmin for
 * itself. The client must refresh its ID token afterwards. There is no way
 * to grant superadmin to other accounts: the list in functions/.env is the
 * only source.
 */
exports.platformClaimSuperadmin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");
  const email = (request.auth.token.email || "").toLowerCase();
  if (!email || request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verify your email address first");
  }
  if (!bootstrapSuperadminEmails().includes(email)) {
    throw new HttpsError("permission-denied", "This account is not on the superadmin list");
  }
  await setClaim(request.auth.uid, true);
  await audit({ uid: request.auth.uid, email }, "superadmin.claim", {});
  return { ok: true };
});
