/**
 * linkGoogleLogin — makes "Sign in with Google" work for people who registered
 * with email + password, and only for them.
 *
 * Signing in with Google can create a brand-new Firebase login (a different
 * uid) even though the person registered earlier with the same email, so the
 * app finds no company for it ("Company not found for this user"). This
 * callable runs for that fresh Google login: it finds the registered login with
 * the same (Google-verified) email, removes the stray Google login and links
 * Google to the registered one — the browser then signs in again with the same
 * Google credential and lands in the right company with the right role. A
 * Google email that was never registered is refused (and the stray login
 * removed), so Google can't be used to get in before registering.
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const {db} = require("../lib/access");
const {planGoogleLink} = require("./googleLinkPlan");

const MESSAGES = {
  "unverified-email": "Google has not verified this email address.",
  "not-registered": "This Google account is not registered with FirmiCore yet. Register your company (or accept your invitation) with email and password first — then you can sign in with Google.",
  "platform-account": "This account cannot be linked to Google here.",
  "inactive": "Your account has been deactivated.",
  "already-linked": "A different Google account is already linked to this login.",
  "not-fresh": "Sign in with your email and password once, then try Google again.",
};

exports.linkGoogleLogin = onCall({cors: true}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const provider = request.auth.token?.firebase?.sign_in_provider;
  if (provider !== "google.com") {
    throw new HttpsError("permission-denied", "This is only for Google sign-in.");
  }
  const googleUid = request.auth.uid;
  const auth = getAuth();
  const google = await auth.getUser(googleUid);
  const email = (google.email || "").toLowerCase();
  if (!email) throw new HttpsError("failed-precondition", MESSAGES["unverified-email"]);

  const googleMapping = await db.collection("users").doc(googleUid).get();

  // The login registered with this email (a different uid from the Google one).
  let registered = null;
  if (!googleMapping.exists) {
    let existing = null;
    try {
      existing = await auth.getUserByEmail(email);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") throw err;
    }
    if (existing) {
      const mapping = existing.uid === googleUid ? null : await db.collection("users").doc(existing.uid).get();
      registered = {
        uid: existing.uid,
        sameAsGoogle: existing.uid === googleUid,
        hasGoogleLinked: existing.providerData.some((p) => p.providerId === "google.com"),
        isSuperadmin: existing.customClaims?.superadmin === true,
        companyId: mapping && mapping.exists ? mapping.get("companyId") || null : null,
        inactive: mapping && mapping.exists ? mapping.get("status") === "inactive" : false,
      };
    }
  }

  const plan = planGoogleLink({
    googleHasCompany: googleMapping.exists,
    googleEmailVerified: request.auth.token?.email_verified === true,
    googleProviders: google.providerData.map((p) => p.providerId),
    googleCreatedMs: new Date(google.metadata.creationTime).getTime(),
    nowMs: Date.now(),
    registered,
  });

  if (plan.action === "ready") return {status: "ready"};

  if (plan.action === "reject") {
    if (plan.deleteGoogleLogin) {
      await auth.deleteUser(googleUid).catch((err) => logger.warn("stray google login not deleted", {googleUid, err}));
    }
    throw new HttpsError("failed-precondition", MESSAGES[plan.reason] || "This Google account cannot be used to sign in.");
  }

  // plan.action === "link": fold the Google login into the registered one.
  const googleInfo = google.providerData.find((p) => p.providerId === "google.com");
  await auth.deleteUser(googleUid);
  await auth.updateUser(registered.uid, {
    emailVerified: true,
    providerToLink: {providerId: "google.com", uid: googleInfo.uid, email, displayName: google.displayName || undefined},
  });
  logger.info("Google linked to registered login", {registeredUid: registered.uid});
  return {status: "linked"};
});
