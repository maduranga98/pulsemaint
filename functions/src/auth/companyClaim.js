const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

/**
 * Keeps the `companyId` custom claim on each user's login token equal to the
 * company in their users/{uid} mapping doc. storage.rules can't read
 * Firestore (named database), so this claim is how it knows which
 * company's files a user may touch. Other claims (e.g. superadmin) are kept.
 * Returns true when the claim changed (the client must refresh its token).
 */
async function setCompanyClaim(uid, companyId) {
  const user = await getAuth().getUser(uid);
  const claims = { ...(user.customClaims ?? {}) };
  const next = typeof companyId === "string" && companyId ? companyId : null;
  if ((claims.companyId ?? null) === next) return false;
  if (next) claims.companyId = next;
  else delete claims.companyId;
  await getAuth().setCustomUserClaims(uid, claims);
  return true;
}

/** Any write to a users/{uid} mapping doc (sign-up, invite accepted, removed) updates the claim. */
exports.onUserMappingWritten = onDocumentWritten(
  { document: "users/{uid}", database: "default" },
  async (event) => {
    const before = event.data?.before?.get("companyId") ?? null;
    const after = event.data?.after?.exists ? event.data.after.get("companyId") ?? null : null;
    if (before === after && event.data?.before?.exists) return;
    try {
      await setCompanyClaim(event.params.uid, after);
    } catch (err) {
      // The mapping doc can outlive a deleted auth account.
      if (err?.code !== "auth/user-not-found") logger.error("onUserMappingWritten claim sync failed", err);
    }
  },
);

/**
 * Called by the app after sign-in when the token has no (or a stale)
 * companyId claim — covers accounts created before the claim existed, and
 * the moments right after sign-up before the trigger above has run.
 */
exports.syncCompanyClaim = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  if (request.auth.token?.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Anonymous accounts have no company.");
  }
  const snap = await db.collection("users").doc(request.auth.uid).get();
  const companyId = snap.exists ? snap.get("companyId") ?? null : null;
  const changed = await setCompanyClaim(request.auth.uid, companyId);
  return { companyId, changed };
});

exports.setCompanyClaim = setCompanyClaim;
