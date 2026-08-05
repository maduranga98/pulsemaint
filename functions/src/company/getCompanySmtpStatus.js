/**
 * getCompanySmtpStatus
 * Callable — reports whether a company has its own SMTP mailbox configured
 * (and the non-secret parts of it, for display) without ever returning the
 * stored password to the client. Settings pages use this to show
 * "Configured: mail.example.com (billing@company.com)" or "Not configured"
 * without a client-side Firestore read of the credentials doc (which the
 * rules deny outright).
 */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore("default");

exports.getCompanySmtpStatus = onCall({maxInstances: 5}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  const {companyId} = request.data || {};
  if (!companyId) {
    throw new HttpsError("invalid-argument", "Missing companyId.");
  }

  const userSnap = await db.doc(`companies/${companyId}/users/${request.auth.uid}`).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "Not a member of this company.");
  }

  const snap = await db.doc(`companies/${companyId}/private/smtp`).get();
  if (!snap.exists) {
    return {configured: false};
  }
  const {host, port, secure, user} = snap.data();
  return {configured: true, host, port, secure: !!secure, user};
});
