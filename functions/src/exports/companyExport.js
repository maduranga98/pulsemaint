const archiver = require("archiver");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const crypto = require("crypto");
const logger = require("firebase-functions/logger");
const {requireOwnCompany} = require("../lib/access");
const {gatherCompanyData, buildTextEntries} = require("./gather");
const {planParts} = require("./exportPlan");
const {markCompanyExported} = require("../retention/retentionStatus");

const db = getFirestore("default");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A queued / running / continuing export with no heartbeat for this long is treated as dead (the function was killed). */
const STALE_MS = 20 * 60 * 1000;
/** One run packs parts only while it has been going for less than this; then it hands over to the next run (the limit is 540 s). */
const RUN_BUDGET_MS = 300 * 1000;
/** Parallel Storage metadata reads while planning. */
const STAT_CONCURRENCY = 40;
const ACTIVE_STATUSES = ["queued", "running", "continue"];
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
async function downloadLinkFor(bucket, file, expires, filename) {
  try {
    const [url] = await file.getSignedUrl({
      action: "read", expires, version: "v4",
      ...(filename ? {responseDisposition: `attachment; filename="${filename}"`} : {}),
    });
    return url;
  } catch (err) {
    logger.warn("Signed URL failed, using a download token link instead", {message: String(err && err.message)});
    const token = crypto.randomUUID();
    await file.setMetadata({metadata: {firebaseStorageDownloadTokens: token}});
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
  }
}

const millis = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);
/** Everything of one export lives under this folder: plan, datasets and the ZIP parts. */
const exportFolder = (companyId, exportId) => `companyExports/${companyId}/${exportId}`;
/** Last time the job showed a sign of life (heartbeat), falling back to when it was created. */
const aliveAt = (e) => Math.max(millis(e.heartbeat), millis(e.createdAt));

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
    return ACTIVE_STATUSES.includes(e.status) && now - aliveAt(e) < STALE_MS;
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

const readJson = async (file) => {
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return JSON.parse(buf.toString("utf8"));
};
const writeJson = (file, value) => file.save(JSON.stringify(value), {contentType: "application/json"});

/** Storage sizes of `paths` (null = the file does not exist), read in parallel. */
async function statAll(bucket, paths, onProgress) {
  const sizes = new Map();
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const [meta] = await bucket.file(path).getMetadata();
        sizes.set(path, Number(meta.size) || 0);
      } catch (err) {
        if (err && err.code !== 404) logger.warn(`Could not read ${path}`, {message: String(err.message)});
        sizes.set(path, null);
      }
      if (sizes.size % 200 === 0) await onProgress(sizes.size, paths.length);
    }
  };
  await Promise.all(Array.from({length: Math.min(STAT_CONCURRENCY, paths.length)}, worker));
  return sizes;
}

/** Reads every record, checks which files exist and how big they are, and decides the ZIP parts. */
async function buildPlan({companyId, bucket, base, beat, job}) {
  const companySnap = await db.collection("companies").doc(companyId).get();
  const company = (companySnap.exists && companySnap.get("name")) || companyId;
  const plants = await db.collection("plants").where("companyId", "==", companyId).get();
  const plantIds = plants.docs.map((d) => d.id);

  await beat({step: "collecting"});
  const gathered = await gatherCompanyData({db, companyId, plantIds, bucketName: bucket.name, onProgress: (p) => beat(p)});

  const paths = [...gathered.files.keys()];
  await beat({step: "checking", done: 0, total: paths.length});
  const sizes = await statAll(bucket, paths, (done, total) => beat({step: "checking", done, total}));
  const missing = paths.filter((p) => sizes.get(p) === null);
  const entries = paths.filter((p) => sizes.get(p) !== null)
      .map((path) => ({path, names: gathered.files.get(path), size: sizes.get(path)}));
  // partMaxBytes / partMaxFiles can only be set by the server (clients cannot write `exports`) — used by the tests.
  const parts = planParts(entries, job.partMaxBytes, job.partMaxFiles);

  await writeJson(bucket.file(`${base}/datasets.json`), gathered.datasets);
  const plan = {
    company, exportedAt: new Date().toISOString(), entries, missing, refused: gathered.refused, parts,
    counts: {records: gathered.counts.records, files: entries.length, missing: missing.length, refused: gathered.refused.length},
  };
  await writeJson(bucket.file(`${base}/plan.json`), plan);
  return plan;
}

/** Streams one part of the plan into `part-N.zip`. Part 1 also carries the viewer, the lists and every record's details. */
async function buildPart({plan, n, bucket, base, beat}) {
  const part = plan.parts[n];
  const outFile = bucket.file(`${base}/part-${n + 1}.zip`);
  const archive = archiver("zip", {zlib: {level: 6}});
  const finished = new Promise((resolve, reject) => {
    const out = outFile.createWriteStream({contentType: "application/zip"});
    out.on("finish", resolve);
    out.on("error", reject);
    archive.on("error", reject);
    archive.pipe(out);
  });
  finished.catch(() => {}); // surfaced by the await below; avoids an unhandled rejection meanwhile

  if (n === 0) {
    const datasets = await readJson(bucket.file(`${base}/datasets.json`));
    const entries = buildTextEntries({company: plan.company, exportedAt: plan.exportedAt, datasets, missing: plan.missing, refused: plan.refused});
    for (const entry of entries) await appendAndWait(archive, Buffer.from(entry.content, "utf8"), entry.name);
  }
  for (let i = part.start; i < part.end; i++) {
    const entry = plan.entries[i];
    const file = bucket.file(entry.path);
    // The same file can belong to several records: one copy in each record's folder.
    for (const name of entry.names) await appendAndWait(archive, file.createReadStream(), name, {store: STORE_ONLY.test(name)});
    if ((i - part.start) % 25 === 0) await beat({step: "packing", part: n + 1, parts: plan.parts.length, done: i - part.start, total: part.end - part.start});
  }
  await archive.finalize();
  await finished;
}

/**
 * One run of an export: plans it (first run), packs as many ZIP parts as fit in
 * the time budget, then either hands over to the next run (status "continue")
 * or finishes with a download link per part. Parts are 1 GB at most, so even
 * a company with many gigabytes is exported — in several ZIPs, which the
 * admin unzips into the same folder.
 */
async function processExport({ref, job, exportId}) {
  const companyId = job.companyId;
  const runStart = Date.now();
  const bucket = getStorage().bucket();
  const base = exportFolder(companyId, exportId);
  const beat = (p) => ref.update({status: "running", progress: p, heartbeat: FieldValue.serverTimestamp()}).catch(() => {});
  let step = "start";
  try {
    step = "collecting";
    await beat({step: "starting"});
    let plan = await readJson(bucket.file(`${base}/plan.json`));
    if (!plan) plan = await buildPlan({companyId, bucket, base, beat, job});

    for (let n = job.nextPart || 0; n < plan.parts.length; n++) {
      if (n > (job.nextPart || 0) && Date.now() - runStart > (job.runBudgetMs ?? RUN_BUDGET_MS)) {
        // Out of time for this run: the update below starts the next one where this stopped.
        await ref.update({status: "continue", nextPart: n, heartbeat: FieldValue.serverTimestamp(), progress: {step: "packing", part: n, parts: plan.parts.length}});
        return;
      }
      step = `packing part ${n + 1} of ${plan.parts.length}`;
      await buildPart({plan, n, bucket, base, beat});
    }

    step = "link";
    const expires = Date.now() + LINK_VALID_MS;
    const downloads = [];
    let total = 0;
    for (let n = 0; n < plan.parts.length; n++) {
      const file = bucket.file(`${base}/part-${n + 1}.zip`);
      const [meta] = await file.getMetadata();
      const sizeBytes = Number(meta.size) || 0;
      total += sizeBytes;
      const name = plan.parts.length > 1 ? `firmicore-export-part-${n + 1}-of-${plan.parts.length}.zip` : "firmicore-export.zip";
      downloads.push({name, url: await downloadLinkFor(bucket, file, expires, name), sizeBytes});
    }
    await ref.update({
      status: "ready",
      progress: {step: "done"},
      downloadUrl: downloads[0].url,
      downloads,
      partCount: downloads.length,
      expiresAt: Timestamp.fromMillis(expires),
      sizeBytes: total,
      counts: plan.counts,
      finishedAt: FieldValue.serverTimestamp(),
    });
    // A finished export covers everything that was finished when it started:
    // the one-year clean-up may now clear those records and the banner goes away.
    await markCompanyExported(db, companyId, exportId, millis(job.createdAt) || Date.now());
    logger.info(`Export ${exportId} for ${companyId} ready`, {records: plan.counts.records, files: plan.counts.files, parts: downloads.length});
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
}

const RUN_OPTIONS = {database: "default", timeoutSeconds: 540, memory: "2GiB", maxInstances: 3};

/** Starts the export for a new `exports/{id}` job. */
exports.runCompanyExport = onDocumentCreated(
    {...RUN_OPTIONS, document: "exports/{exportId}"},
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const job = snap.data();
      if (!job.companyId || job.status !== "queued") return;
      await processExport({ref: snap.ref, job, exportId: event.params.exportId});
    },
);

/** Carries on with a big export that ran out of time (status switched to "continue"). */
exports.continueCompanyExport = onDocumentUpdated(
    {...RUN_OPTIONS, document: "exports/{exportId}"},
    async (event) => {
      const before = event.data && event.data.before.data();
      const after = event.data && event.data.after.data();
      if (!before || !after || !after.companyId) return;
      if (after.status !== "continue" || before.status === "continue") return;
      await processExport({ref: event.data.after.ref, job: after, exportId: event.params.exportId});
    },
);

/** Daily: removes finished exports (file + job) after two days, and marks dead jobs failed. */
exports.cleanupCompanyExports = onSchedule("every day 03:40", async () => {
  const now = Date.now();
  const bucket = getStorage().bucket();
  const old = await db.collection("exports").where("createdAt", "<", Timestamp.fromMillis(now - 2 * DAY)).limit(200).get();
  for (const d of old.docs) {
    const e = d.data();
    if (e.companyId) {
      await bucket.deleteFiles({prefix: `${exportFolder(e.companyId, d.id)}/`}).catch(() => {});
      await bucket.file(`companyExports/${e.companyId}/${d.id}.zip`).delete({ignoreNotFound: true}).catch(() => {}); // exports made before parts existed
    }
    await d.ref.delete();
  }
  const stuck = await db.collection("exports").where("status", "in", ACTIVE_STATUSES).get();
  for (const d of stuck.docs) {
    if (now - aliveAt(d.data()) > STALE_MS) {
      await d.ref.update({status: "failed", error: "The export did not finish. Try again."});
    }
  }
  logger.info(`Export cleanup: removed ${old.size}`);
});
