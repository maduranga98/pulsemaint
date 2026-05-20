/**
 * reverseImport — HTTPS callable
 * Input: { sessionId: string, companyId: string }
 *
 * Checks that the import session is within the 24-hour reversal window.
 * Deletes only parts that were CREATED by this session (not updated ones),
 * but only if they have had no subsequent stockMovements.
 * Marks the session as 'reversed'.
 *
 * Returns: { reversedCount, skippedCount }
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 400;

exports.reverseImport = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const { sessionId, companyId } = request.data;

  if (!sessionId || !companyId) {
    throw new HttpsError("invalid-argument", "sessionId and companyId are required");
  }

  const sessionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("inventoryImportSessions")
    .doc(sessionId);

  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new HttpsError("not-found", "Import session not found");
  }

  const session = sessionSnap.data();

  if (session.status === "reversed") {
    throw new HttpsError("failed-precondition", "This import has already been reversed");
  }

  if (session.status !== "completed") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot reverse a session with status '${session.status}'`,
    );
  }

  // Check 24-hour window
  const startedAt = session.startedAt?.toDate?.() ?? new Date(0);
  const ageMs = Date.now() - startedAt.getTime();
  if (ageMs > TWENTY_FOUR_HOURS_MS) {
    throw new HttpsError(
      "deadline-exceeded",
      "Import reversal window has expired (24 hours)",
    );
  }

  const partsCollection = db
    .collection("companies")
    .doc(companyId)
    .collection("inventoryParts");
  const movementsCollection = db
    .collection("companies")
    .doc(companyId)
    .collection("stockMovements");

  const createdPartIds = session.createdPartIds ?? [];
  let reversedCount = 0;
  let skippedCount = 0;

  // Process in batches
  for (let i = 0; i < createdPartIds.length; i += BATCH_SIZE) {
    const chunk = createdPartIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const partId of chunk) {
      // Check if any stockMovements exist for this part (other than reserve movements from the same session)
      const movementsSnap = await movementsCollection
        .where("partId", "==", partId)
        .limit(1)
        .get();

      if (!movementsSnap.empty) {
        // Part has been touched — skip deletion
        skippedCount++;
        continue;
      }

      batch.delete(partsCollection.doc(partId));
      reversedCount++;
    }

    await batch.commit();
  }

  // Mark session as reversed
  await sessionRef.update({
    status: "reversed",
    reversedAt: Timestamp.now(),
    reversedBy: request.auth.uid,
    reversedCount,
    skippedCount,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(
    `reverseImport: session ${sessionId} — reversed:${reversedCount} skipped:${skippedCount}`,
  );

  return { reversedCount, skippedCount };
});
