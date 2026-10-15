/**
 * Server-side training progress: quiz grading and no-quiz completion.
 *
 * Trainees used to grade their own quiz in the browser and write the score,
 * pass flag and status straight onto their assignment — which also let a
 * trainee mark themselves passed or certified (and the
 * generateTrainingCertificate trigger then issued a real certificate).
 * firestore.rules now only let a trainee record lesson progress; these two
 * callables are the only way a trainee's quiz result or completion is
 * written, and they grade against the module stored on the server.
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const {db, requireMember} = require("../lib/access");
const {scoreQuizAttempt, hasPassedQuiz, attemptsRemaining, requiredLessonsComplete} = require("./quizScorer");

/** Same 30-minute retry cooldown the quiz screen shows after a failed attempt. */
const FAILED_ATTEMPT_COOLDOWN_MS = 30 * 60 * 1000;

const DONE_STATUSES = new Set(["certified", "expired"]);

/**
 * Loads an assignment the caller owns, plus its module, and checks both
 * belong to the caller's company.
 * @param {object} request callable request
 * @param {string} assignmentId assignment doc id
 * @return {Promise<{ref: object, assignment: object, module: object}>}
 */
async function loadOwnAssignment(request, assignmentId) {
  if (typeof assignmentId !== "string" || !assignmentId) {
    throw new HttpsError("invalid-argument", "assignmentId is required.");
  }
  const ref = db.collection("trainingAssignments").doc(assignmentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Training assignment not found.");
  const assignment = snap.data();
  await requireMember(request, assignment.companyId);
  if (assignment.traineeId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "This training is assigned to someone else.");
  }
  const moduleSnap = assignment.moduleId ?
    await db.collection("trainingModules").doc(String(assignment.moduleId)).get() :
    null;
  if (!moduleSnap || !moduleSnap.exists) throw new HttpsError("not-found", "Training module not found.");
  const module = moduleSnap.data();
  if (module.companyId !== assignment.companyId) {
    throw new HttpsError("permission-denied", "Training module belongs to another company.");
  }
  return {ref, assignment, module};
}

exports.submitTrainingQuiz = onCall(async (request) => {
  const {assignmentId, answers, startedAtMs} = request.data || {};
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new HttpsError("invalid-argument", "answers must be an object of questionId → optionIds.");
  }
  const {ref, module} = await loadOwnAssignment(request, assignmentId);
  const quiz = module.quiz;
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new HttpsError("failed-precondition", "This module has no quiz.");
  }

  const nowMs = Date.now();
  const started = Number(startedAtMs);
  const startedMs = Number.isFinite(started) && started > 0 && started <= nowMs ? started : nowMs;
  const timeTakenSeconds = Math.max(0, Math.round((nowMs - startedMs) / 1000));

  // Grade against the quiz stored on the server, using the same pass mark
  // the trainee is shown (the quiz's own, else the module default).
  const raw = scoreQuizAttempt(quiz.questions, answers);
  const passingScore = Number.isFinite(Number(quiz.passingScore)) ?
    Number(quiz.passingScore) :
    (Number.isFinite(Number(module.passingScore)) ? Number(module.passingScore) : 70);
  const passed = hasPassedQuiz(raw.score, passingScore);
  // Trainee-programme modules are completed by passing their final test; the
  // single practical sign-off happens once, for the whole programme.
  const isProgrammeModule = module.libraryScope === "trainee_management";

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const a = snap.data();
    if (DONE_STATUSES.has(a.status)) {
      throw new HttpsError("failed-precondition", "This training is already complete.");
    }
    if (a.quizPassed === true) {
      throw new HttpsError("failed-precondition", "You have already passed this quiz.");
    }
    if (!requiredLessonsComplete(module.lessons, a.lessonProgress)) {
      throw new HttpsError("failed-precondition", "Finish every required lesson before taking the quiz.");
    }
    const remaining = attemptsRemaining(quiz.maxAttempts, a.attemptsUsed);
    if (remaining !== null && remaining <= 0) {
      throw new HttpsError("failed-precondition", "No quiz attempts remaining.");
    }
    const attempts = Array.isArray(a.quizAttempts) ? a.quizAttempts : [];
    const last = attempts[attempts.length - 1];
    const lastMs = last && last.completedAt && typeof last.completedAt.toMillis === "function" ?
      last.completedAt.toMillis() :
      0;
    if (last && last.passed === false && lastMs && nowMs - lastMs < FAILED_ATTEMPT_COOLDOWN_MS) {
      throw new HttpsError("failed-precondition", "Please wait 30 minutes after a failed attempt before retrying.");
    }

    const attemptNumber = (Number.isFinite(a.attemptsUsed) ? a.attemptsUsed : 0) + 1;
    const now = Timestamp.fromMillis(nowMs);
    const attempt = {
      attemptId: `attempt_${attemptNumber}_${nowMs}`,
      attemptNumber,
      startedAt: Timestamp.fromMillis(startedMs),
      completedAt: now,
      score: raw.score,
      passed,
      totalQuestions: raw.totalQuestions,
      correctAnswers: raw.correctAnswers,
      answers: raw.answers,
      timeTakenSeconds,
    };
    const bestScore = Math.max(Number(a.bestScore) || 0, raw.score);
    tx.update(ref, {
      quizAttempts: FieldValue.arrayUnion(attempt),
      attemptsUsed: attemptNumber,
      latestScore: raw.score,
      bestScore,
      quizPassed: passed,
      ...(passed ?
        isProgrammeModule ?
          {quizPassedAt: now, status: "quiz_passed", completedAt: now} :
          {quizPassedAt: now, status: "awaiting_practical"} :
        {status: "quiz_failed"}),
      lastActivityAt: now,
    });
    return {...raw, passed, timeTakenSeconds, attemptNumber, passingScore};
  });

  return result;
});

/**
 * Completes an assignment whose module has no quiz, once every required
 * lesson is done (the old "acknowledge" button). Marking it certified fires
 * generateTrainingCertificate, which checks `completedVia`.
 */
exports.completeTrainingAssignment = onCall(async (request) => {
  const {assignmentId} = request.data || {};
  const {ref, module} = await loadOwnAssignment(request, assignmentId);
  const hasQuiz = !!module.quiz && Array.isArray(module.quiz.questions) && module.quiz.questions.length > 0;
  if (hasQuiz) {
    throw new HttpsError("failed-precondition", "This module is completed by passing its quiz.");
  }
  if ((module.category || "machine") === "offboard") {
    throw new HttpsError("failed-precondition", "Offboard training is completed by a practical sign-off.");
  }
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const a = snap.data();
    if (DONE_STATUSES.has(a.status)) return;
    if (!requiredLessonsComplete(module.lessons, a.lessonProgress)) {
      throw new HttpsError("failed-precondition", "Finish every required lesson first.");
    }
    tx.update(ref, {
      status: "certified",
      overallProgress: 100,
      completedVia: "acknowledgement",
      completedAt: FieldValue.serverTimestamp(),
      certifiedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
    });
  });
  return {ok: true};
});
