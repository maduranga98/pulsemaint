const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue } = require("firebase-admin/firestore");
const { db, bootstrapSuperadminEmails, requireSuperadmin, audit } = require("./platformAccess");

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
 * itself. The client must refresh its ID token afterwards.
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

/** Grant or revoke superadmin for another account, by email. */
exports.platformSetSuperadmin = onCall(async (request) => {
  const actor = requireSuperadmin(request);
  const { email, enabled } = request.data ?? {};
  if (typeof email !== "string" || !email.includes("@")) throw new HttpsError("invalid-argument", "email is required");
  let user;
  try {
    user = await getAuth().getUserByEmail(email.trim());
  } catch {
    throw new HttpsError("not-found", "No FirmiCore account uses that email");
  }
  if (!enabled && user.uid === actor.uid) throw new HttpsError("failed-precondition", "You cannot remove your own superadmin access");
  await setClaim(user.uid, !!enabled);
  await audit(actor, enabled ? "superadmin.grant" : "superadmin.revoke", { targetUid: user.uid, targetEmail: user.email });
  return { ok: true };
});

exports.platformListSuperadmins = onCall(async (request) => {
  requireSuperadmin(request);
  const snap = await db.collection("platformAdmins").get();
  return {
    admins: snap.docs.map((d) => ({
      uid: d.id,
      email: d.get("email") ?? null,
      name: d.get("name") ?? null,
      grantedAt: d.get("grantedAt")?.toMillis?.() ?? null,
    })),
  };
});
