const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const {randomUUID} = require("crypto");
const {sendEmail, brandedEmail, platformSmtpPassword} = require("../lib/mailer");
const {
  MAX_ATTEMPTS,
  getInviteAccess,
  scoreSubmission,
  publicModuleContent,
  validateAttachments,
  applyFinalSubmission,
} = require("./logic");
const {buildInviteEmail} = require("./email");

// Contractor safety training — link-based training for contractor team
// members, who have no FirmiCore login. The assigning staff create an invite
// doc per team member (safetyTrainingInvites/{token}); the team member opens
// /safety-training/{token}, which talks to the two public callables below.
// The token is the only credential, so everything a visitor can read or write
// goes through these callables — never straight to Firestore/Storage.

const db = getFirestore("default");

const APP_URL = "https://app.firmicore.com";
const INVITES = "safetyTrainingInvites";
const STAFF_ROLES = ["admin", "plant_manager", "hr_officer", "safety_officer"];
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function tokenFrom(data) {
  const token = data && data.token;
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw new HttpsError("not-found", "This link is not valid.");
  }
  return token;
}

function millis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

async function loadCompanyAndPlant(companyId, plantId) {
  const [companySnap, plantSnap] = await Promise.all([
    db.doc(`companies/${companyId}`).get(),
    plantId ? db.doc(`plants/${plantId}`).get() : Promise.resolve(null),
  ]);
  const company = companySnap.exists ? companySnap.data() : {};
  const plant = plantSnap && plantSnap.exists ? plantSnap.data() : null;
  return {
    companyName: company.name || "Your client",
    timezone: company.timezone || "UTC",
    plantName: plant && plant.name ? plant.name : "",
  };
}

// ---------------------------------------------------------------------------
// Staff: email the link to contractor team members
// ---------------------------------------------------------------------------

exports.sendContractorSafetyTrainingInvites = onCall(
    {maxInstances: 5, secrets: [platformSmtpPassword]},
    async (request) => {
      if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

      const userSnap = await db.doc(`users/${request.auth.uid}`).get();
      const user = userSnap.exists ? userSnap.data() : null;
      if (!user || !user.companyId || !STAFF_ROLES.includes(user.role)) {
        throw new HttpsError("permission-denied", "Not allowed to send safety training links.");
      }

      const ids = request.data && request.data.inviteIds;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((i) => typeof i === "string" && TOKEN_PATTERN.test(i))) {
        throw new HttpsError("invalid-argument", "inviteIds must be 1–100 invite ids.");
      }

      const results = [];
      const contexts = new Map();
      for (const id of ids) {
        const ref = db.collection(INVITES).doc(id);
        const snap = await ref.get();
        if (!snap.exists || snap.data().companyId !== user.companyId) {
          results.push({inviteId: id, status: "not_found"});
          continue;
        }
        const inv = snap.data();
        if (inv.status === "signed_off" || inv.status === "reassigned") {
          results.push({inviteId: id, status: "closed"});
          continue;
        }
        if (!inv.technicianEmail) {
          await ref.update({emailStatus: "no_email"});
          results.push({inviteId: id, status: "no_email"});
          continue;
        }

        const ctxKey = `${inv.companyId}|${inv.plantId || ""}`;
        if (!contexts.has(ctxKey)) contexts.set(ctxKey, await loadCompanyAndPlant(inv.companyId, inv.plantId));
        const ctx = contexts.get(ctxKey);

        const link = `${APP_URL}/safety-training/${id}`;
        const {html, text} = buildInviteEmail(inv, link, ctx, millis(inv.dueAt));
        const sent = await sendEmail({
          to: inv.technicianEmail,
          subject: `Safety training required — ${inv.moduleTitle}`,
          html: brandedEmail(html, ctx.companyName),
          text,
          fromName: ctx.companyName,
        });
        await ref.update(sent ?
          {emailStatus: "sent", emailSentAt: FieldValue.serverTimestamp()} :
          {emailStatus: "failed"});
        results.push({inviteId: id, status: sent ? "sent" : "failed"});
      }
      return {results};
    },
);

// ---------------------------------------------------------------------------
// Public: load the form
// ---------------------------------------------------------------------------

function attemptSummary(a) {
  return {
    attemptNumber: a.attemptNumber,
    submittedAtMs: millis(a.submittedAt),
    hasQuiz: !!a.hasQuiz,
    score: a.score === undefined ? null : a.score,
    passed: !!a.passed,
    attachmentCount: (a.attachments || []).length,
  };
}

exports.getContractorSafetyTrainingForm = onCall({maxInstances: 20}, async (request) => {
  const token = tokenFrom(request.data);
  const snap = await db.collection(INVITES).doc(token).get();
  if (!snap.exists) throw new HttpsError("not-found", "This link is not valid.");
  const inv = snap.data();

  const moduleSnap = await db.doc(`trainingModules/${inv.moduleId}`).get();
  if (!moduleSnap.exists) throw new HttpsError("not-found", "This training is no longer available.");
  const ctx = await loadCompanyAndPlant(inv.companyId, inv.plantId);

  const dueAtMs = millis(inv.dueAt);
  const access = getInviteAccess(inv, dueAtMs, Date.now());
  // Only the final submission is kept (the count of attempts is attemptsUsed),
  // so that is all there is to show. Older invites may still hold more than
  // one stored attempt — show just the last of those too.
  const attempts = (inv.attempts || []).slice(-1).map(attemptSummary);

  return {
    invite: {
      technicianName: inv.technicianName,
      contractorName: inv.contractorName,
      moduleTitle: inv.moduleTitle,
      companyName: ctx.companyName,
      plantName: ctx.plantName,
      timezone: ctx.timezone,
      dueAtMs,
      maxAttempts: inv.maxAttempts || MAX_ATTEMPTS,
      attemptsUsed: inv.attemptsUsed || 0,
      hasQuiz: !!inv.hasQuiz,
      passingScore: inv.passingScore,
      status: inv.status,
    },
    access,
    // Only needed while the form can still be filled in.
    content: access.open ? publicModuleContent(moduleSnap.data()) : null,
    attempts,
  };
});

// ---------------------------------------------------------------------------
// Public: submit
// ---------------------------------------------------------------------------

async function notifySubmission(inv, attempt) {
  const result = attempt.hasQuiz ? ` — ${attempt.score}% (${attempt.passed ? "passed" : "below pass mark"})` : "";
  const message = `${inv.technicianName} (${inv.contractorName}) submitted "${inv.moduleTitle}"${result}`;
  const roles = ["safety_officer", "admin", "plant_manager"];
  const userIds = inv.assignedBy ? [inv.assignedBy] : [];
  await db.collection("notifications").add({
    companyId: inv.companyId,
    type: "training",
    severity: "medium",
    message,
    oversightMessage: message,
    linkTo: "/app/training/manage/safety-trainings",
    recipientRoles: roles,
    targetRoles: ["safety_officer"],
    recipientUserIds: userIds,
    targetUserIds: userIds,
    actorName: inv.technicianName,
    actorRole: null,
    actorUserId: null,
    plantId: inv.plantId || null,
    department: null,
    read: false,
    readBy: [],
    timestamp: FieldValue.serverTimestamp(),
  });
}

exports.submitContractorSafetyTraining = onCall(
    {maxInstances: 10, memory: "512MiB", timeoutSeconds: 120},
    async (request) => {
      const token = tokenFrom(request.data);
      const data = request.data || {};

      if (data.acknowledged !== true) {
        throw new HttpsError("invalid-argument", "Please confirm the declaration.");
      }
      const declarationName = typeof data.declarationName === "string" ? data.declarationName.trim() : "";
      if (declarationName.length < 2 || declarationName.length > 120) {
        throw new HttpsError("invalid-argument", "Please type your full name as your signature.");
      }
      const notes = typeof data.notes === "string" ? data.notes.trim().slice(0, 2000) : "";
      const answersIn = data.answers && typeof data.answers === "object" && !Array.isArray(data.answers) ? data.answers : {};

      const ref = db.collection(INVITES).doc(token);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "This link is not valid.");
      const inv = snap.data();

      const closedMessage = {
        signed_off: "This training has already been signed off.",
        reassigned: "This link has been replaced. Please use the newer link you were sent.",
        attempts_exhausted: "You have used all your attempts.",
        expired: "The due date and time has passed, so this link is closed.",
      };
      const access = getInviteAccess(inv, millis(inv.dueAt), Date.now());
      if (!access.open) throw new HttpsError("failed-precondition", closedMessage[access.reason], {reason: access.reason});

      const moduleSnap = await db.doc(`trainingModules/${inv.moduleId}`).get();
      if (!moduleSnap.exists) throw new HttpsError("not-found", "This training is no longer available.");
      const mod = moduleSnap.data();

      const quiz = mod.quiz && Array.isArray(mod.quiz.questions) && mod.quiz.questions.length > 0 ? mod.quiz : null;
      if (quiz) {
        const unanswered = quiz.questions.some((q) => !Array.isArray(answersIn[q.id]) || answersIn[q.id].length === 0);
        if (unanswered) throw new HttpsError("invalid-argument", "Please answer every question.");
      }
      // Same threshold the invite recorded: the quiz's own pass mark, else the module's.
      const passMark = quiz && Number.isFinite(quiz.passingScore) ? quiz.passingScore : mod.passingScore;
      const scored = scoreSubmission(quiz, passMark, answersIn);

      let files;
      try {
        files = validateAttachments(data.attachments);
      } catch (err) {
        throw new HttpsError("invalid-argument", err.message);
      }

      // Upload first, then commit the attempt in a transaction that
      // re-checks the attempt count (two tabs submitting at once must not
      // both squeeze in under the limit). Files from a rejected attempt are
      // removed again; once one is accepted it replaces the earlier
      // attempt's data (only the final submission is kept).
      const attemptNumber = (inv.attemptsUsed || 0) + 1;
      const bucket = getStorage().bucket();
      const uploaded = [];
      try {
        for (const f of files) {
          const path = `safetyTrainingSubmissions/${inv.companyId}/${token}/attempt-${attemptNumber}/${randomUUID()}-${f.name}`;
          const downloadToken = randomUUID();
          await bucket.file(path).save(f.buffer, {
            resumable: false,
            metadata: {
              contentType: f.mimeType,
              metadata: {firebaseStorageDownloadTokens: downloadToken},
            },
          });
          uploaded.push({
            name: f.name,
            kind: f.kind,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            path,
            url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`,
          });
        }

        const {entry: attempt, replacedFiles} = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          const cur = fresh.data();
          const again = getInviteAccess(cur, millis(cur.dueAt), Date.now());
          if (!again.open) throw new HttpsError("failed-precondition", closedMessage[again.reason], {reason: again.reason});

          const number = (cur.attemptsUsed || 0) + 1;
          const entry = {
            attemptNumber: number,
            submittedAt: Timestamp.now(),
            hasQuiz: scored.hasQuiz,
            score: scored.score,
            earnedPoints: scored.earnedPoints,
            totalPoints: scored.totalPoints,
            correctAnswers: scored.correctAnswers,
            totalQuestions: scored.totalQuestions,
            passed: scored.passed,
            answers: scored.answers,
            notes,
            declarationName,
            attachments: uploaded,
          };
          // Only the final submission is kept — it replaces whatever was
          // stored before; attemptsUsed carries the count.
          const {update, replacedFiles: replaced} = applyFinalSubmission(cur, entry);
          tx.update(ref, update);
          return {entry, replacedFiles: replaced};
        });

        // The earlier attempts' photos and voice notes are no longer
        // referenced by anything — remove them (best effort; the submission
        // itself already succeeded).
        try {
          await Promise.all(replacedFiles.map((path) => bucket.file(path).delete({ignoreNotFound: true})));
        } catch (err) {
          logger.warn("Could not remove files from earlier safety training attempts", {token, error: err.message});
        }

        try {
          await notifySubmission(inv, attempt);
        } catch (err) {
          logger.warn("Safety training submission notification failed", {token, error: err.message});
        }

        const remaining = Math.max(0, (inv.maxAttempts || MAX_ATTEMPTS) - attempt.attemptNumber);
        return {
          attemptNumber: attempt.attemptNumber,
          attemptsRemaining: remaining,
          hasQuiz: attempt.hasQuiz,
          score: attempt.score,
          passed: attempt.passed,
          passingScore: inv.passingScore,
          // Another try is only offered while the link would still open.
          canRetry: remaining > 0 && Date.now() <= millis(inv.dueAt),
        };
      } catch (err) {
        await Promise.all(uploaded.map((u) => bucket.file(u.path).delete({ignoreNotFound: true}).catch(() => {})));
        if (err instanceof HttpsError) throw err;
        logger.error("submitContractorSafetyTraining failed", {token, error: err.message});
        throw new HttpsError("internal", "Could not save your submission. Please try again.");
      }
    },
);
