/**
 * confirmPartsIssue — HTTPS callable
 * Input: { requestId: string, issuedItems: [{itemId: string, quantityIssued: number}], companyId: string }
 *
 * Firestore transaction:
 *   For each issued item:
 *     inventoryParts: currentStock -= qty, reservedStock -= qty,
 *                     totalUsedAllTime += qty, totalCostAllTime += qty*unitCost,
 *                     lastIssuedAt = now
 *     Create stockMovement (type='issue')
 *   partsRequest: status='issued', issuedAt=now, issuedBy=uid
 *
 * Returns: { success: true }
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore();

exports.confirmPartsIssue = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const { requestId, issuedItems, companyId } = request.data;

  if (!requestId || !companyId || !Array.isArray(issuedItems) || !issuedItems.length) {
    throw new HttpsError(
      "invalid-argument",
      "requestId, companyId, and issuedItems[] are required",
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

      if (!["parts_reserved", "approved"].includes(partsRequest.status)) {
        throw new HttpsError(
          "failed-precondition",
          `Parts request status '${partsRequest.status}' does not allow issuing`,
        );
      }

      const now = Timestamp.now();

      // Build a map of original items for cost lookup
      const originalItems = {};
      for (const item of partsRequest.items ?? []) {
        originalItems[item.itemId ?? item.partId] = item;
      }

      // Process each issued item
      for (const issued of issuedItems) {
        const { itemId, quantityIssued } = issued;
        const qty = Number(quantityIssued) || 0;
        if (qty <= 0) continue;

        // Resolve partId — issuedItems may carry partId directly or via itemId
        const originalItem = originalItems[itemId] ?? {};
        const partId = issued.partId ?? originalItem.partId ?? itemId;

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
        const unitCost = part.unitCost ?? originalItem.unitCost ?? 0;

        // Update inventoryPart
        tx.update(partRef, {
          currentStock: FieldValue.increment(-qty),
          reservedStock: FieldValue.increment(-qty),
          totalUsedAllTime: FieldValue.increment(qty),
          totalCostAllTime: FieldValue.increment(qty * unitCost),
          lastIssuedAt: now,
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
          movementType: "issue",
          quantity: qty,
          quantityBefore: part.currentStock ?? 0,
          quantityAfter: (part.currentStock ?? 0) - qty,
          unitCost,
          totalCost: qty * unitCost,
          referenceType: "partsRequest",
          referenceId: requestId,
          notes: `Issued for parts request ${requestId}`,
          performedBy: callerUid,
          performedAt: now,
          createdAt: now,
        });
      }

      // Fetch issuer name
      let issuedByName = "";
      try {
        const userDoc = await db.collection("users").doc(callerUid).get();
        if (userDoc.exists) {
          const u = userDoc.data();
          issuedByName = u.displayName ?? u.name ?? "";
        }
      } catch (_) {
        // best-effort
      }

      // Update partsRequest
      tx.update(requestRef, {
        status: "issued",
        issuedAt: now,
        issuedBy: callerUid,
        issuedByName,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    });

    logger.info(`confirmPartsIssue: issued parts for request ${requestId}`);
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error(`confirmPartsIssue failed for ${requestId}`, err);
    throw new HttpsError("internal", "Failed to confirm parts issue");
  }
});
