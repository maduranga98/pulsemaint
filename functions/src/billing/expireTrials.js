/**
 * expireTrials
 * Runs daily via Cloud Scheduler. A company still on a free trial whose
 * trialEndsAt has passed — with no Stripe subscription and no plan assigned by
 * Lumora — is suspended (status "suspended", reason "trial_expired"). That
 * reuses the existing "subscription ended" flow: every user is sent to the
 * subscription-ended page, the admin can still open Billing & Plan to
 * subscribe, and no data is deleted. A superadmin extending the trial
 * (platformUpdateCompany → extendTrial) or a successful Stripe checkout
 * reactivates the company.
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

/** Whether a company document is a trial that has run out. Exported for tests. */
function shouldExpire(company, now = Date.now()) {
  if (!company || company.status !== "trial") return false;
  if (company.stripeSubscriptionId || company.planSetBy === "platform") return false;
  // Registrations awaiting (or denied) approval have no trial running yet.
  if (company.approvalStatus === "pending" || company.approvalStatus === "rejected") return false;
  const end = company.trialEndsAt && typeof company.trialEndsAt.toMillis === "function" ? company.trialEndsAt.toMillis() : null;
  return end !== null && end <= now;
}

exports.shouldExpire = shouldExpire;

exports.expireTrials = onSchedule({schedule: "30 1 * * *", timeZone: "Asia/Colombo"}, async () => {
  // Filter the date in memory: equality on status + range on trialEndsAt would need a composite index.
  const snap = await db.collection("companies").where("status", "==", "trial").get();
  const now = Date.now();
  let expired = 0;
  for (const doc of snap.docs) {
    if (!shouldExpire(doc.data(), now)) continue;
    try {
      await doc.ref.update({
        status: "suspended",
        suspendedReason: "trial_expired",
        suspendedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      expired += 1;
    } catch (err) {
      logger.error(`Could not expire trial for company ${doc.id}`, err);
    }
  }
  logger.info(`expireTrials: suspended ${expired} of ${snap.size} trial companies`);
});
