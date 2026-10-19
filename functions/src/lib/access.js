const {HttpsError} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

let cachedDb = null;
/**
 * The named "default" database, opened on first use so requiring this file
 * never runs before initializeApp().
 * @return {object} Firestore
 */
function getDb() {
  if (!cachedDb) cachedDb = getFirestore("default");
  return cachedDb;
}

/** Roles that manage a company's work (sign-offs, scheduling, reports …). */
const MANAGER_ROLES = ["admin", "plant_manager", "supervisor", "maintenance_supervisor", "hr_officer", "safety_officer"];

/**
 * The standard check for any callable that acts on a company's data.
 *
 * A login alone is not enough: request.auth also matches anonymous sessions
 * (the public QR breakdown page signs visitors in anonymously) and users of
 * other companies. The caller must be a signed-in, non-anonymous member of
 * `companyId` (per the users/{uid} mapping firestore.rules also trust), not
 * deactivated, and — when `roles` is given — hold one of those roles.
 *
 * @param {object} request the callable request
 * @param {string} companyId the company the call acts on
 * @param {{roles?: string[]}} [options] optional role allow-list
 * @return {Promise<object>} the caller's users/{uid} mapping data (+ uid)
 */
async function requireMember(request, companyId, options = {}) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  if (request.auth.token?.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Sign in with your FirmiCore account.");
  }
  if (typeof companyId !== "string" || !companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }
  const snap = await getDb().collection("users").doc(request.auth.uid).get();
  const user = snap.exists ? snap.data() : null;
  if (!user || user.companyId !== companyId) {
    throw new HttpsError("permission-denied", "You do not belong to this company.");
  }
  if (user.status === "inactive") {
    throw new HttpsError("permission-denied", "Your account has been deactivated.");
  }
  if (Array.isArray(options.roles) && !options.roles.includes(user.role)) {
    throw new HttpsError("permission-denied", "Your role cannot do this.");
  }
  return {...user, uid: request.auth.uid};
}

/**
 * The caller's own company (from their mapping), for callables that act on
 * "my company" without taking a companyId argument.
 * @param {object} request the callable request
 * @param {{roles?: string[]}} [options] optional role allow-list
 * @return {Promise<object>} the caller's mapping data (+ uid)
 */
async function requireOwnCompany(request, options = {}) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const snap = await getDb().collection("users").doc(request.auth.uid).get();
  const companyId = snap.exists ? snap.get("companyId") : null;
  return requireMember(request, companyId, options);
}

/** Escapes text for safe insertion into an HTML email body. */
function escapeHtml(value) {
  return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

module.exports = {getDb, MANAGER_ROLES, requireMember, requireOwnCompany, escapeHtml};
// `db` reads lazily too, so `const {db} = require(...)` works in any module
// loaded after initializeApp().
Object.defineProperty(module.exports, "db", {enumerable: true, get: getDb});
