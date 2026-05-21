/**
 * confirmPartsReturn — HTTPS callable
 * Input: { requestId: string, returnedItems: [{itemId: string, quantityReturned: number}], companyId: string }
 *
 * Firestore transaction:
 *   For each returned item:
 *     inventoryParts: currentStock += qty, lastReceivedAt = now
 *     Create stockMovement (type='return')
 *   partsRequest: status='completed', returnedAt = now
 *
 * Returns: { success: true }
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

exports.confirmPartsReturn = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const { requestId, returnedItems, companyId } = request.data;

  if (!requestId || !companyId || !Array.isArray(returnedItems) || !returnedItems.length) {
    throw new HttpsError(
      "invalid-argument",
      "requestId, companyId, and returnedItems[] are required",
    );
  }

  const callerUid = request.auth.uid;

  try {
    const result = await db.runTransaction(async (tx) => {
      // Fetch partsRequest
      const requestRef = db
        .collection("companies")
        .doc(companyId)
        .collection("partsRequests")
        .doc(requestId);
      const requestSnap = await tx.get(requestRef);

      if (!requestSnap.exists) {
        throw new HttpsError("not-found", "Parts request not found");
      }

      const partsRequest = requestSnap.data();

      if (!["issued"].includes(partsRequest.status)) {
        throw new HttpsError(
          "failed-precondition",
          `Parts request status '${partsRequest.status}' does not allow returning parts`,
        );
      }

      const now = Timestamp.now();

      // Build a map of original items for reference
      const originalItems = {};
      for (const item of partsRequest.items ?? []) {
        originalItems[item.itemId ?? item.partId] = item;
      }

      for (const returned of returnedItems) {
        const { itemId, quantityReturned } = returned;
        const qty = Number(quantityReturned) || 0;
        if (qty <= 0) continue;

        const originalItem = originalItems[itemId] ?? {};
        const partId = returned.partId ?? originalItem.partId ?? itemId;

        const partRef = db
          .collection("companies")
          .doc(companyId)
          .collection("inventoryParts")
          .doc(partId);
        const partSnap = await tx.get(partRef);

        if (!partSnap.exists) {
          throw new HttpsError("not-found", `Part ${partId} not found`);
        }

        const part = partSnap.data();

        // Update inventoryPart — add back returned quantity
        tx.update(partRef, {
          currentStock: FieldValue.increment(qty),
          lastReceivedAt: now,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Create stockMovement
        const movementRef = db
          .collection("companies")
          .doc(companyId)
          .collection("stockMovements")
          .doc();
        tx.set(movementRef, {
          companyId,
          partId,
          partName: part.partName ?? originalItem.partName ?? "",
          partNumber: part.partNumber ?? "",
          movementType: "return",
          quantity: qty,
          quantityBefore: part.currentStock ?? 0,
          quantityAfter: (part.currentStock ?? 0) + qty,
          referenceType: "partsRequest",
          referenceId: requestId,
          notes: `Returned from parts request ${requestId}`,
          performedBy: callerUid,
          performedAt: now,
          createdAt: now,
        });
      }

      // Update partsRequest
      tx.update(requestRef, {
        status: "completed",
        returnedAt: now,
        returnedBy: callerUid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    });

    logger.info(`confirmPartsReturn: returned parts for request ${requestId}`);
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error(`confirmPartsReturn failed for ${requestId}`, err);
    throw new HttpsError("internal", "Failed to confirm parts return");
  }
});
