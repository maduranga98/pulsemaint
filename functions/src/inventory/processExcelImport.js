/**
 * processExcelImport — HTTPS callable
 * Input: { sessionId: string, companyId: string, rows: ParsedRow[] }
 *
 * ParsedRow shape:
 *   { partNumber, partName, category, currentStock, minStockLevel, unitCost,
 *     unit, location, supplier, description, isCritical }
 *
 * Creates an inventoryImportSession doc, batch-writes parts (create or update),
 * then updates the session with result counts.
 *
 * Returns: { newCount, updatedCount, skippedCount }
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore();
const BATCH_SIZE = 400; // Firestore max is 500; leave headroom

exports.processExcelImport = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const { sessionId, companyId, rows } = request.data;

  if (!sessionId || !companyId || !Array.isArray(rows)) {
    throw new HttpsError(
      "invalid-argument",
      "sessionId, companyId, and rows[] are required",
    );
  }

  const callerUid = request.auth.uid;
  const now = Timestamp.now();

  const sessionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("inventoryImportSessions")
    .doc(sessionId);

  // Create/mark session as 'processing'
  await sessionRef.set(
    {
      companyId,
      sessionId,
      importedBy: callerUid,
      startedAt: now,
      status: "processing",
      totalRows: rows.length,
      newCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const partsCollection = db
    .collection("companies")
    .doc(companyId)
    .collection("inventoryParts");

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const createdPartIds = [];

  try {
    // Process rows in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const row of chunk) {
        const partNumber = (row.partNumber ?? "").toString().trim();
        const partName = (row.partName ?? "").toString().trim();

        if (!partNumber && !partName) {
          skippedCount++;
          continue;
        }

        let existingRef = null;

        // Look up by partNumber if provided
        if (partNumber) {
          const existingSnap = await partsCollection
            .where("partNumber", "==", partNumber)
            .limit(1)
            .get();

          if (!existingSnap.empty) {
            existingRef = existingSnap.docs[0].ref;
          }
        }

        const partData = {
          companyId,
          partNumber: partNumber || null,
          partName: partName || partNumber,
          category: row.category ?? null,
          currentStock: Number(row.currentStock) || 0,
          minStockLevel: Number(row.minStockLevel) || 0,
          unitCost: Number(row.unitCost) || 0,
          unit: row.unit ?? "pcs",
          location: row.location ?? null,
          supplier: row.supplier ?? null,
          description: row.description ?? null,
          isCritical: Boolean(row.isCritical) || false,
          isLowStock: (Number(row.currentStock) || 0) <= (Number(row.minStockLevel) || 0),
          status: "active",
          updatedAt: now,
          importSessionId: sessionId,
        };

        if (existingRef) {
          batch.update(existingRef, partData);
          updatedCount++;
        } else {
          const newRef = partsCollection.doc();
          batch.set(newRef, {
            ...partData,
            reservedStock: 0,
            totalUsedAllTime: 0,
            totalCostAllTime: 0,
            createdAt: now,
          });
          createdPartIds.push(newRef.id);
          newCount++;
        }
      }

      await batch.commit();
    }

    // Update session with results
    await sessionRef.update({
      status: "completed",
      newCount,
      updatedCount,
      skippedCount,
      createdPartIds,
      completedAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(
      `processExcelImport: session ${sessionId} — new:${newCount} updated:${updatedCount} skipped:${skippedCount}`,
    );

    return { newCount, updatedCount, skippedCount };
  } catch (err) {
    // Mark session as failed
    await sessionRef
      .update({
        status: "failed",
        errorMessage: err.message ?? "Unknown error",
        updatedAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    logger.error(`processExcelImport failed for session ${sessionId}`, err);
    throw new HttpsError("internal", "Excel import failed: " + (err.message ?? "Unknown error"));
  }
});
