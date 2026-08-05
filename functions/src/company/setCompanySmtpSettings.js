/**
 * setCompanySmtpSettings
 * Callable — lets a company admin configure their own SMTP mailbox so
 * outgoing supplier emails (PO sent/priced/cancelled, delivery receipt) send
 * from the company's own address instead of the shared platform mailbox.
 * The transporter is verified (a real SMTP login) before anything is saved,
 * so a typo'd password/host is caught immediately rather than silently
 * failing on the next PO email.
 *
 * Credentials are written to companies/{companyId}/private/smtp, a path
 * whose Firestore rules deny all client read/write — only this callable
 * (via the Admin SDK, which bypasses rules) and the mailer ever touch it.
 */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

const MANAGE_ROLES = ["admin", "plant_manager"];

exports.setCompanySmtpSettings = onCall({maxInstances: 5}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const {companyId, host, port, secure, user, pass} = request.data || {};
  if (!companyId || !host || !port || !user || !pass) {
    throw new HttpsError("invalid-argument", "host, port, user, and pass are all required.");
  }

  const userSnap = await db.doc(`companies/${companyId}/users/${request.auth.uid}`).get();
  const role = userSnap.exists ? userSnap.data().role : null;
  if (!role || !MANAGE_ROLES.includes(role)) {
    throw new HttpsError("permission-denied", "Only an admin or plant manager can configure email sending.");
  }

  const portNum = Number(port);
  if (!Number.isFinite(portNum) || portNum <= 0) {
    throw new HttpsError("invalid-argument", "Port must be a positive number.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: portNum,
    secure: !!secure,
    auth: {user, pass},
  });

  try {
    await transporter.verify();
  } catch (err) {
    logger.warn(`SMTP verify failed for company ${companyId}`, err);
    throw new HttpsError("failed-precondition", `Could not connect with these settings: ${err.message || err}`);
  }

  await db.doc(`companies/${companyId}/private/smtp`).set({
    host,
    port: portNum,
    secure: !!secure,
    user,
    pass,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });

  return {ok: true};
});
