/**
 * Weekly clean-up of finished long-term records older than a year (see
 * retentionPlan.js for exactly what is and isn't cleared).
 *
 * Each rule queries one timestamp field below the cutoff (a single-field
 * range, so no composite index) and then checks the status in code, so open
 * work can never match. Deletes are batched; a run handles a bounded amount
 * and the next run continues.
 */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {RETENTION_DAYS, RETENTION_RULES, isExpired} = require("./retentionPlan");

const db = getFirestore("default");
const PAGE = 400;
const MAX_PAGES_PER_RULE = 20;

exports.clearExpiredRecords = onSchedule(
    {schedule: "every sunday 02:00", timeZone: "Asia/Colombo", timeoutSeconds: 540, memory: "512MiB"},
    async () => {
      const nowMs = Date.now();
      const cutoff = Timestamp.fromMillis(nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const totals = {};
      for (const rule of RETENTION_RULES) {
        try {
          for (let page = 0; page < MAX_PAGES_PER_RULE; page++) {
            const snap = await db.collection(rule.collection)
                .where(rule.dateField, "<", cutoff).limit(PAGE).get();
            if (snap.empty) break;
            const expired = snap.docs.filter((d) => isExpired(rule, d.data(), nowMs));
            if (expired.length > 0) {
              const batch = db.batch();
              expired.forEach((d) => batch.delete(d.ref));
              await batch.commit();
              totals[rule.collection] = (totals[rule.collection] || 0) + expired.length;
            }
            // Nothing in this page was deletable (e.g. old but not finished):
            // the same page would come back forever, so stop this rule.
            if (expired.length === 0 || snap.size < PAGE) break;
          }
        } catch (err) {
          logger.error(`clearExpiredRecords failed for ${rule.collection}.${rule.dateField}`, err);
        }
      }
      logger.info("clearExpiredRecords", totals);
    },
);
