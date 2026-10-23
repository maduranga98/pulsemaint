const archiver = require("archiver");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const crypto = require("crypto");
const logger = require("firebase-functions/logger");
const {requireOwnCompany} = require("../lib/access");
const {gatherCompanyData, buildTextEntries} = require("./gather");

const db = getFirestore("default");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A "running" export older than this is treated as dead (the function was killed). */
const STALE_MS = 20 * 60 * 1000;
const MAX_PER_DAY = 3;
const LINK_VALID_MS = DAY;
/** Already-compressed types are stored as they are — no point spending CPU on them. */
const STORE_ONLY = /\.(jpe?g|png|gif|webp|mp4|mov|webm|zip|pdf|docx?|xlsx?)$/i;

/**
 * A link the admin can download the ZIP with. A V4 signed URL needs the
 * runtime service account to be allowed to sign (iam.serviceAccounts.signBlob);
 * when that is missing, fall back to a Firebase download-token link, which
 * needs no signing and stops working when the file is deleted (two days).
 */
async function downloadLinkFor(bucket, file, expires) {
  try {
    const [url] = await file.getSignedUrl({action: "read", expires, version: "v4"});
    return url;
  } catch (err) {
    logger.warn("Signed URL failed, using a download token link instead", {message: String(err && err.message)});
    const token = crypto.randomUUID();
    await file.setMetadata({metadata: {firebaseStorageDownloadTokens: token}});
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
  }
}

const millis = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);
const zipPath = (companyId, exportId) => `companyExports/${companyId}/${exportId}.zip`;

/**
 * Admin asks for a full export of their own company. Only creates the job
 * document (runCompanyExport does the work in the background); the admin's
 * page watches `exports/{id}` and shows a download link when it is ready.
 */
exports.requestCompanyExport = onCall({maxInstances: 5}, async (request) => {
  const user = await requireOwnCompany(request, {roles: ["admin"]});
  const companyId = user.companyId;

  const recent = await db.collection("exports").where("companyId", "==", companyId)
      .orderBy("createdAt", "desc").limit(10).get();
  const now = Date.now();
  const active = recent.docs.find((d) => {
    const e = d.data();
    return (e.status === "queued" || e.status === "running") && now - millis(e.createdAt) < STALE_MS;
  });
  if (active) throw new HttpsError("failed-precondition", "An export is already being prepared. Wait for it to finish.");
  const today = recent.docs.filter((d) => now - millis(d.data().createdAt) < DAY).length;
  if (today >= MAX_PER_DAY) throw new HttpsError("resource-exhausted", `At most ${MAX_PER_DAY} exports can be requested per day.`);

  const ref = await db.collection("exports").add({
    companyId,
    requestedBy: user.uid,
    status: "queued",
    progress: {step: "queued"},
    createdAt: FieldValue.serverTimestamp(),
  });
  return {id: ref.id};
});

function appendAndWait(archive, source, name, options = {}) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
    };
    const onEntry = (entry) => {
      if (entry.name === name) {
        cleanup();
        resolve();
      }
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    archive.on("entry", onEntry);
    archive.on("error", onError);
    archive.append(source, {name, ...options});
  });
}

/** Builds the ZIP for one `exports/{id}` job. */
exports.runCompanyExport = onDocumentCreated(
    {database: "default", document: "exports/{exportId}", timeoutSeconds: 540, memory: "2GiB", maxInstances: 3},
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const job = snap.data();
      const companyId = job.companyId;
      const exportId = event.params.exportId;
      if (!companyId || job.status !== "queued") return;
      const ref = snap.ref;
      const progress = (p) => ref.update({status: "running", progress: p}).catch(() => {});
      let step = "start";

      try {
        step = "collecting";
        await progress({step: "collecting"});
        const companySnap = await db.collection("companies").doc(companyId).get();
        const company = (companySnap.exists && companySnap.get("name")) || companyId;
        const plants = await db.collection("plants").where("companyId", "==", companyId).get();
        const plantIds = plants.docs.map((d) => d.id);

        const bucket = getStorage().bucket();
        const gathered = await gatherCompanyData({
          db, companyId, plantIds, bucketName: bucket.name,
          onProgress: (p) => progress(p),
        });

        step = "packing";
        const outFile = bucket.file(zipPath(companyId, exportId));
        const archive = archiver("zip", {zlib: {level: 6}});
        const finished = new Promise((resolve, reject) => {
          const out = outFile.createWriteStream({contentType: "application/zip"});
          out.on("finish", resolve);
          out.on("error", reject);
          archive.on("error", reject);
          archive.pipe(out);
        });
        finished.catch(() => {}); // surfaced by the await below; avoids an unhandled rejection meanwhile

        const exportedAt = new Date().toISOString();
        const missing = [];
        const paths = [...gathered.files.keys()];
        await progress({step: "packing", done: 0, total: paths.length});
        let done = 0;
        for (const path of paths) {
          const file = bucket.file(path);
          const [exists] = await file.exists();
          if (!exists) {
            missing.push(path);
          } else {
            const name = gathered.files.get(path);
            await appendAndWait(archive, file.createReadStream(), name, {store: STORE_ONLY.test(name)});
          }
          done++;
          if (done % 25 === 0) await progress({step: "packing", done, total: paths.length});
        }

        for (const entry of buildTextEntries({company, exportedAt, datasets: gathered.datasets, missing, refused: gathered.refused})) {
          await appendAndWait(archive, Buffer.from(entry.content, "utf8"), entry.name);
        }
        await archive.finalize();
        await finished;

        step = "link";
        const [meta] = await outFile.getMetadata();
        const expires = Date.now() + LINK_VALID_MS;
        const downloadUrl = await downloadLinkFor(bucket, outFile, expires);
        await ref.update({
          status: "ready",
          progress: {step: "done"},
          downloadUrl,
          expiresAt: Timestamp.fromMillis(expires),
          sizeBytes: Number(meta.size) || 0,
          counts: {records: gathered.counts.records, files: gathered.counts.files - missing.length, missing: missing.length, refused: gathered.refused.length},
          finishedAt: FieldValue.serverTimestamp(),
        });
        logger.info(`Export ${exportId} for ${companyId} ready`, {records: gathered.counts.records, files: gathered.counts.files});
      } catch (err) {
        logger.error(`Export ${exportId} for ${companyId} failed at "${step}"`, err);
        // The admin sees where it failed and a short reason (no stack, no data).
        const reason = String((err && err.message) || err).replace(/\s+/g, " ").slice(0, 200);
        await ref.update({
          status: "failed",
          error: "The export could not be completed. Try again, or contact support.",
          failedStep: step,
          errorDetail: reason,
          finishedAt: FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
    },
);

/** Daily: removes finished exports (file + job) after two days, and marks dead jobs failed. */
exports.cleanupCompanyExports = onSchedule("every day 03:40", async () => {
  const now = Date.now();
  const bucket = getStorage().bucket();
  const old = await db.collection("exports").where("createdAt", "<", Timestamp.fromMillis(now - 2 * DAY)).limit(200).get();
  for (const d of old.docs) {
    const e = d.data();
    if (e.companyId) await bucket.file(zipPath(e.companyId, d.id)).delete({ignoreNotFound: true}).catch(() => {});
    await d.ref.delete();
  }
  const stuck = await db.collection("exports").where("status", "==", "running").get();
  for (const d of stuck.docs) {
    if (now - millis(d.data().createdAt) > STALE_MS) {
      await d.ref.update({status: "failed", error: "The export did not finish. Try again."});
    }
  }
  logger.info(`Export cleanup: removed ${old.size}`);
});
