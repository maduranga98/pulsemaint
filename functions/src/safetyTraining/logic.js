// Pure helpers for contractor safety training — no firebase-admin imports so
// they can be unit tested without credentials (src/lib/__tests__).

const MAX_ATTEMPTS = 3;
const MAX_IMAGES = 5;
const MAX_AUDIO = 2;
// Raw bytes across every attachment of one submission. The callable request
// is capped at 10 MB and base64 adds a third on top.
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);
const AUDIO_TYPES = new Set([
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a",
  "audio/aac", "audio/wav", "audio/x-wav", "audio/wave",
]);

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

/**
 * Whether the invite can still take a submission. Mirrors getInviteAccess in
 * src/lib/safety/contractorSafety.ts.
 * @param {object} inv invite data (status, attemptsUsed, maxAttempts)
 * @param {number} dueAtMs link closes at this time
 * @param {number} nowMs current time
 * @return {{open: boolean, reason?: string, attemptsRemaining?: number}}
 */
function getInviteAccess(inv, dueAtMs, nowMs) {
  if (inv.status === "signed_off") return {open: false, reason: "signed_off"};
  if (inv.status === "reassigned") return {open: false, reason: "reassigned"};
  const max = inv.maxAttempts > 0 ? inv.maxAttempts : MAX_ATTEMPTS;
  const remaining = max - (inv.attemptsUsed || 0);
  if (remaining <= 0) return {open: false, reason: "attempts_exhausted"};
  if (nowMs > dueAtMs) return {open: false, reason: "expired"};
  return {open: true, attemptsRemaining: remaining};
}

/**
 * Scores a submission against the module's quiz. Same rules as the in-app
 * quiz (src/lib/training/quizScorer.ts): every correct option and no
 * incorrect one, weighted by question points.
 * @param {object|null} quiz the module's final test
 * @param {number} passingScore module passing percentage
 * @param {object} answers questionId -> selected option ids
 * @return {object} score summary + per-question answers
 */
function scoreSubmission(quiz, passingScore, answers) {
  const questions = (quiz && Array.isArray(quiz.questions)) ? quiz.questions : [];
  if (questions.length === 0) {
    return {
      hasQuiz: false,
      score: null,
      earnedPoints: 0,
      totalPoints: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      passed: true,
      answers: [],
    };
  }
  let totalPoints = 0;
  let earnedPoints = 0;
  let correctAnswers = 0;
  const details = questions.map((q) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
    const given = answers && Array.isArray(answers[q.id]) ? answers[q.id] : [];
    // Only ids that are real options count — stray ids can't be correct.
    const valid = new Set(options.map((o) => o.id));
    const selected = [...new Set(given.filter((id) => valid.has(id)))];
    const isCorrect = correctIds.length > 0 &&
      selected.length === correctIds.length &&
      correctIds.every((id) => selected.includes(id));
    const points = Number.isFinite(q.points) && q.points > 0 ? q.points : 1;
    totalPoints += points;
    if (isCorrect) {
      earnedPoints += points;
      correctAnswers += 1;
    }
    return {
      questionId: q.id,
      selectedOptionIds: selected,
      isCorrect,
      pointsEarned: isCorrect ? points : 0,
    };
  });
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const threshold = Number.isFinite(passingScore) ? passingScore : 80;
  return {
    hasQuiz: true,
    score,
    earnedPoints,
    totalPoints,
    correctAnswers,
    totalQuestions: questions.length,
    passed: score >= threshold,
    answers: details,
  };
}

/**
 * The module as the public form may see it: lessons and quiz questions, but
 * never which options are correct or the explanations.
 * @param {object} module trainingModules doc data
 * @return {object} sanitized content
 */
function publicModuleContent(module) {
  const lessons = (module.lessons || []).map((l) => ({
    id: l.id || "",
    order: l.order || 0,
    title: l.title || "",
    type: l.type || "text",
    contentUrl: l.contentUrl || "",
    thumbnailUrl: l.thumbnailUrl || "",
    description: l.description || "",
    durationSeconds: l.durationSeconds || 0,
    isRequired: l.isRequired !== false,
  })).sort((a, b) => a.order - b.order);

  const quiz = module.quiz && Array.isArray(module.quiz.questions) && module.quiz.questions.length > 0 ?
    {
      title: module.quiz.title || "",
      instructions: module.quiz.instructions || "",
      shuffleQuestions: !!module.quiz.shuffleQuestions,
      shuffleOptions: !!module.quiz.shuffleOptions,
      questions: module.quiz.questions.map((q) => ({
        id: q.id,
        order: q.order || 0,
        text: q.text || "",
        type: q.type || "single_choice",
        imageUrl: q.imageUrl || "",
        points: Number.isFinite(q.points) && q.points > 0 ? q.points : 1,
        options: (q.options || []).map((o) => ({id: o.id, text: o.text || ""})),
      })).sort((a, b) => a.order - b.order),
    } : null;

  return {
    title: module.title || "Safety Training",
    description: module.description || "",
    lessons,
    quiz,
  };
}

/**
 * Decoded byte length of a base64 string.
 * @param {string} b64 base64 payload (no data: prefix)
 * @return {number} bytes
 */
function base64ByteLength(b64) {
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.endsWith("==")) padding = 2;
  else if (b64.endsWith("=")) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Keeps a user-supplied file name safe for a Storage path.
 * @param {string} name original name
 * @param {string} ext extension to force
 * @return {string} sanitized file name
 */
function safeFileName(name, ext) {
  const base = String(name || "attachment")
      .replace(/\.[^.]*$/, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "attachment";
  return `${base}.${ext}`;
}

/**
 * Validates and normalizes the attachments of a submission. Throws an Error
 * with a user-presentable message when something is off.
 * @param {Array} list [{name, mimeType, data(base64)}]
 * @return {Array} [{name, mimeType, kind, ext, buffer, sizeBytes}]
 */
function validateAttachments(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new Error("Attachments are invalid.");
  let images = 0;
  let audio = 0;
  let total = 0;
  const out = [];
  for (const item of list) {
    if (!item || typeof item.data !== "string" || typeof item.mimeType !== "string") {
      throw new Error("An attachment is invalid.");
    }
    const mime = item.mimeType.split(";")[0].trim().toLowerCase();
    let kind;
    if (IMAGE_TYPES.has(mime)) {
      kind = "image";
      images += 1;
    } else if (AUDIO_TYPES.has(mime)) {
      kind = "audio";
      audio += 1;
    } else {
      throw new Error("Only images and voice recordings can be attached.");
    }
    const b64 = item.data.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error("An attachment is invalid.");
    const size = base64ByteLength(b64);
    if (size === 0) throw new Error("An attachment is empty.");
    total += size;
    const ext = EXTENSIONS[mime];
    out.push({
      name: safeFileName(item.name, ext),
      mimeType: mime,
      kind,
      ext,
      buffer: Buffer.from(b64, "base64"),
      sizeBytes: size,
    });
  }
  if (images > MAX_IMAGES) throw new Error(`You can attach up to ${MAX_IMAGES} images.`);
  if (audio > MAX_AUDIO) throw new Error(`You can attach up to ${MAX_AUDIO} voice recordings.`);
  if (total > MAX_ATTACHMENT_BYTES) throw new Error("The attachments are too large. Use fewer or smaller files.");
  return out;
}

module.exports = {
  MAX_ATTEMPTS,
  MAX_IMAGES,
  MAX_AUDIO,
  MAX_ATTACHMENT_BYTES,
  getInviteAccess,
  scoreSubmission,
  publicModuleContent,
  validateAttachments,
  safeFileName,
};
