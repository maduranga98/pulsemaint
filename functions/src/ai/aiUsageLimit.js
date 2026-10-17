/**
 * Fixed-window usage limits for the AI proxy (claudeJson), so one signed-in
 * user — or one compromised account — cannot run up the Anthropic bill.
 *
 * Counters live in `aiUsage/{key}` (Admin SDK only; the Firestore rules have
 * no client access to this collection). Each counter belongs to one hour (per
 * user) or one UTC day (per company); expired counters are harmless and are
 * overwritten the next window because the key contains the window.
 */
const {HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {aiCreditLimit} = require("../lib/planFeatures");

const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const PER_USER_PER_HOUR = num("AI_LIMIT_USER_PER_HOUR", 40);
const PER_COMPANY_PER_DAY = num("AI_LIMIT_COMPANY_PER_DAY", 500);

const hourKey = (now) => now.toISOString().slice(0, 13); // 2026-10-11T08
const dayKey = (now) => now.toISOString().slice(0, 10); // 2026-10-11

/** Counts this call against the user's and company's windows, or throws resource-exhausted. */
async function consumeAiQuota(db, {uid, companyId}, now = new Date()) {
  const userRef = db.collection("aiUsage").doc(`user_${uid}_${hourKey(now)}`);
  const companyRef = db.collection("aiUsage").doc(`company_${companyId || "none"}_${dayKey(now)}`);

  await db.runTransaction(async (tx) => {
    const [userSnap, companySnap] = await Promise.all([tx.get(userRef), tx.get(companyRef)]);
    const userCount = userSnap.exists ? userSnap.get("count") || 0 : 0;
    const companyCount = companySnap.exists ? companySnap.get("count") || 0 : 0;
    if (userCount >= PER_USER_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "AI request limit reached for this hour. Please try again later.");
    }
    if (companyCount >= PER_COMPANY_PER_DAY) {
      throw new HttpsError("resource-exhausted", "Your company has reached today's AI request limit.");
    }
    tx.set(userRef, {count: userCount + 1, uid, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    tx.set(companyRef, {count: companyCount + 1, companyId: companyId || null, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
  });
}

const monthKey = (now) => now.toISOString().slice(0, 7); // 2026-10

/**
 * Charges `cost` AI credits (1 = a normal suggestion, 6 = one with web
 * research) against the company's monthly allowance from its plan — see
 * aiCreditLimit() in lib/planFeatures.js — or throws resource-exhausted.
 * Counters live in `aiUsage/credits_{companyId}_{YYYY-MM}`. Returns the
 * credits used and the allowance (null = unlimited).
 */
async function consumeMonthlyCredits(db, {companyId, cost}, now = new Date()) {
  if (!companyId) return {used: 0, limit: null};
  const companySnap = await db.collection("companies").doc(companyId).get();
  const limit = aiCreditLimit(companySnap.exists ? companySnap.data() : null);
  const ref = db.collection("aiUsage").doc(`credits_${companyId}_${monthKey(now)}`);
  const used = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.get("used") || 0 : 0;
    if (limit !== null && current + cost > limit) {
      throw new HttpsError("resource-exhausted",
          `Your plan's ${limit} AI credits for this month are used up. Add credits or upgrade to continue.`);
    }
    tx.set(ref, {used: current + cost, companyId, month: monthKey(now), updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    return current + cost;
  });
  return {used, limit};
}

/** Gives credits back when the AI provider failed after they were charged. */
async function refundMonthlyCredits(db, {companyId, cost}, now = new Date()) {
  if (!companyId) return;
  const ref = db.collection("aiUsage").doc(`credits_${companyId}_${monthKey(now)}`);
  await ref.set({used: FieldValue.increment(-cost), updatedAt: FieldValue.serverTimestamp()}, {merge: true}).catch(() => {});
}

module.exports = {consumeAiQuota, consumeMonthlyCredits, refundMonthlyCredits, monthKey, PER_USER_PER_HOUR, PER_COMPANY_PER_DAY, hourKey, dayKey};
