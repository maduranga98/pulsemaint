/**
 * removeCompanySmtpSettings
 * Callable — clears a company's configured SMTP mailbox, reverting future
 * supplier emails to the shared platform mailbox.
 */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore("default");

const MANAGE_ROLES = ["admin", "plant_manager"];

exports.removeCompanySmtpSettings = onCall({maxInstances: 5}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  const {companyId} = request.data || {};
  if (!companyId) {
    throw new HttpsError("invalid-argument", "Missing companyId.");
  }

  const userSnap = await db.doc(`companies/${companyId}/users/${request.auth.uid}`).get();
  const role = userSnap.exists ? userSnap.data().role : null;
  if (!role || !MANAGE_ROLES.includes(role)) {
    throw new HttpsError("permission-denied", "Only an admin or plant manager can configure email sending.");
  }

  await db.doc(`companies/${companyId}/private/smtp`).delete();
  return {ok: true};
});
