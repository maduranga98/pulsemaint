const crypto = require("crypto");
const {HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

/**
 * Best-effort caller address of a callable request — the first
 * X-Forwarded-For hop (Cloud Functions sits behind Google's front end),
 * else the socket address.
 * @param {object} request the callable request
 * @return {string} the address, or "unknown"
 */
function clientIp(request) {
  const raw = request.rawRequest || {};
  const forwarded = raw.headers && raw.headers["x-forwarded-for"];
  const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return first || raw.ip || "unknown";
}

/**
 * Fixed-window counter for callables anyone can reach without signing in
 * (the public QR breakdown page). Counts hits per key and window in
 * `publicRateLimits` (server-only: no client rules) and throws
 * `resource-exhausted` once `limit` is passed. The key is hashed so no raw
 * address is stored; `expireAt` lets a Firestore TTL policy sweep old windows.
 * @param {string} key what is being limited, e.g. "ip:1.2.3.4:report"
 * @param {number} limit hits allowed per window
 * @param {number} windowMs window length in milliseconds
 * @return {Promise<void>} resolves while under the limit
 */
async function enforceRateLimit(key, limit, windowMs) {
  const db = getFirestore("default");
  const windowIndex = Math.floor(Date.now() / windowMs);
  const id = `${crypto.createHash("sha256").update(key).digest("hex").slice(0, 40)}_${windowIndex}`;
  const ref = db.collection("publicRateLimits").doc(id);
  const count = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists ? snap.get("count") : 0) + 1;
    tx.set(ref, {count: next, expireAt: Timestamp.fromMillis((windowIndex + 2) * windowMs)});
    return next;
  });
  if (count > limit) {
    throw new HttpsError("resource-exhausted", "Too many requests. Please wait a few minutes and try again.");
  }
}

module.exports = {clientIp, enforceRateLimit};
