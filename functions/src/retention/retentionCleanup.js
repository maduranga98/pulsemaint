/**
 * Daily clean-up of finished long-term records older than a year (see
 * retentionPlan.js for exactly what is and isn't cleared).
 *
 * Nothing is deleted until the company's admin has exported the data: an
 * expired record is cleared only when a successful company export started
 * after it finished (`retentionStatus.lastExportAt`). Until then the admin
 * gets a bell notification and a banner (`noticeActive`); a successful export
 * removes both, and the next run clears the expired records together with the
 * Storage files that belong to them.
 *
 * Each rule walks one timestamp field below the cutoff (a single-field range,
 * so no composite index) with a cursor and checks the status in code, so open
 * work can never match. A run handles a bounded amount and the next continues.
 */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, Timestamp, FieldValue} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const {RETENTION_DAYS, RETENTION_RULES, classify, companyOf, ownedFilePaths} = require("./retentionPlan");
const {NOTICE_TYPE, removeRetentionNotifications} = require("./retentionStatus");
const {sendNotification} = require("../lib/notify");

const db = getFirestore("default");
const PAGE = 400;
const MAX_PAGES_PER_RULE = 25;
const DELETE_CONCURRENCY = 10;

/**
 * @param {object[]} items things to process
 * @param {Function} fn async worker
 * @return {Promise<void>}
 */
async function inChunks(items, fn) {
  for (let i = 0; i < items.length; i += DELETE_CONCURRENCY) {
    await Promise.all(items.slice(i, i + DELETE_CONCURRENCY).map(fn));
  }
}

exports.clearExpiredRecords = onSchedule(
    {schedule: "every day 02:00", timeZone: "Asia/Colombo", timeoutSeconds: 540, memory: "512MiB"},
    async () => {
      const nowMs = Date.now();
      const cutoff = Timestamp.fromMillis(nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const bucket = getStorage().bucket();
      const exportedAt = new Map(); // companyId -> ms of the last successful export (or null)
      const lastExport = async (companyId) => {
        if (!exportedAt.has(companyId)) {
          const snap = await db.collection("retentionStatus").doc(companyId).get();
          exportedAt.set(companyId, (snap.exists && snap.get("lastExportAt")) || null);
        }
        return exportedAt.get(companyId);
      };

      const waiting = new Map(); // companyId -> {count, byCollection, oldest}
      const cleared = {};
      const clearedBy = new Map(); // companyId -> count
      let files = 0;

      for (const rule of RETENTION_RULES) {
        try {
          let last = null;
          for (let page = 0; page < MAX_PAGES_PER_RULE; page++) {
            let q = db.collection(rule.collection).where(rule.dateField, "<", cutoff).orderBy(rule.dateField).limit(PAGE);
            if (last) q = q.startAfter(last);
            const snap = await q.get();
            if (snap.empty) break;
            last = snap.docs[snap.docs.length - 1];

            const toDelete = [];
            for (const d of snap.docs) {
              const data = d.data();
              const company = companyOf(data);
              const decision = classify(rule, data, nowMs, company ? await lastExport(company) : null);
              if (decision === "delete") {
                toDelete.push({d, data, company});
              } else if (decision === "blocked") {
                const w = waiting.get(company) || {count: 0, byCollection: {}, oldest: null};
                const ms = data[rule.dateField].toMillis();
                w.count++;
                w.byCollection[rule.collection] = (w.byCollection[rule.collection] || 0) + 1;
                w.oldest = w.oldest === null ? ms : Math.min(w.oldest, ms);
                waiting.set(company, w);
              }
            }
            await inChunks(toDelete, async ({d, data, company}) => {
              for (const path of ownedFilePaths(d.id, data, bucket.name)) {
                try {
                  await bucket.file(path).delete({ignoreNotFound: true});
                  files++;
                } catch (err) {
                  logger.warn(`Could not delete ${path}`, {message: String(err && err.message)});
                }
              }
              await db.recursiveDelete(d.ref); // the record and its sub-collections
              cleared[rule.collection] = (cleared[rule.collection] || 0) + 1;
              if (company) clearedBy.set(company, (clearedBy.get(company) || 0) + 1);
            });
            if (snap.size < PAGE) break;
          }
        } catch (err) {
          logger.error(`clearExpiredRecords failed for ${rule.collection}.${rule.dateField}`, err);
        }
      }

      // Tell each admin whose expired data is still waiting for an export.
      const month = new Date(nowMs).toISOString().slice(0, 7);
      for (const [companyId, w] of waiting) {
        try {
          await db.collection("retentionStatus").doc(companyId).set({
            companyId,
            noticeActive: true,
            pendingCount: w.count,
            byCollection: w.byCollection,
            oldestExpiredAt: w.oldest,
            updatedAt: FieldValue.serverTimestamp(),
          }, {merge: true});
          await sendNotification(db, {
            companyId,
            type: NOTICE_TYPE,
            roles: ["admin"],
            severity: "high",
            message: `${w.count}+ records are older than a year. Export your data (Settings → Export all data) — expired data is deleted only after you export it.`,
            linkTo: "/app/settings",
            dedupeKey: `retention-expiry:${month}`,
          });
        } catch (err) {
          logger.error(`retention notice failed for ${companyId}`, err);
        }
      }

      // Notice that no longer applies (everything was exported and cleared).
      try {
        const active = await db.collection("retentionStatus").where("noticeActive", "==", true).get();
        for (const d of active.docs) {
          if (waiting.has(d.id)) continue;
          await d.ref.set({noticeActive: false, pendingCount: 0, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
          await removeRetentionNotifications(db, d.id);
        }
        for (const [companyId, n] of clearedBy) {
          await db.collection("retentionStatus").doc(companyId).set({
            companyId, lastClearedAt: Date.now(), clearedCount: FieldValue.increment(n),
          }, {merge: true});
        }
      } catch (err) {
        logger.error("retention status update failed", err);
      }
      logger.info("clearExpiredRecords", {cleared, files, waitingCompanies: waiting.size});
    },
);
