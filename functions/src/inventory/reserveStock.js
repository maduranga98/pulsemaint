/**
 * reserveStock — HTTPS callable
 * Input: { requestId: string, companyId: string }
 *
 * Firestore transaction (all-or-nothing):
 *   1. Fetch partsRequest
 *   2. For each item: fetch inventoryParts doc
 *   3. Check availableStock >= quantityApproved for ALL items
 *   4. If all OK: update each part (reservedStock += qty, currentStock stays, availableStock recalculated)
 *      Update partsRequest: status='parts_reserved', reservedAt=now
 *      Create stockMovement (type='reserve') for each item
 *   5. If any item unavailable: throw HttpsError (all-or-nothing rollback)
 *
 * Returns: { success: true }
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore();

exports.reserveStock = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  const { requestId, companyId } = request.data;

  if (!requestId || !companyId) {
    throw new HttpsError("invalid-argument", "requestId and companyId are required");
  }

  const callerUid = request.auth.uid;

  try {
    const result = await db.runTransaction(async (tx) => {
      // 1. Fetch partsRequest
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

      if (!["approved", "pending"].includes(partsRequest.status)) {
        throw new HttpsError(
          "failed-precondition",
          `Parts request is in status '${partsRequest.status}' and cannot be reserved`,
        );
      }

      const items = partsRequest.items ?? [];
      if (!items.length) {
        throw new HttpsError("invalid-argument", "Parts request has no items");
      }

      // 2. Fetch all part docs
      const partRefs = items.map((item) =>
        db.collection("companies").doc(companyId).collection("inventoryParts").doc(item.partId),
      );
      const partSnaps = await Promise.all(partRefs.map((ref) => tx.get(ref)));

      // 3. Check availability for ALL items
      const unavailable = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const partSnap = partSnaps[i];

        if (!partSnap.exists) {
          unavailable.push({ partId: item.partId, reason: "Part not found" });
          continue;
        }

        const part = partSnap.data();
        const qtyApproved = item.quantityApproved ?? item.quantityRequested ?? 0;
        const available = (part.currentStock ?? 0) - (part.reservedStock ?? 0);

        if (available < qtyApproved) {
          unavailable.push({
            partId: item.partId,
            partName: part.partName ?? item.partName,
            available,
            requested: qtyApproved,
            reason: "Insufficient stock",
          });
        }
      }

      if (unavailable.length > 0) {
        throw new HttpsError(
          "resource-exhausted",
          `Insufficient stock for ${unavailable.length} item(s)`,
          { unavailable },
        );
      }

      // 4. All available — apply updates
      const now = Timestamp.now();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const partRef = partRefs[i];
        const partSnap = partSnaps[i];
        const part = partSnap.data();
        const qtyApproved = item.quantityApproved ?? item.quantityRequested ?? 0;

        // Update inventoryPart
        tx.update(partRef, {
          reservedStock: FieldValue.increment(qtyApproved),
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
          partId: item.partId,
          partName: part.partName ?? item.partName ?? "",
          partNumber: part.partNumber ?? "",
          movementType: "reserve",
          quantity: qtyApproved,
          quantityBefore: part.currentStock ?? 0,
          quantityAfter: part.currentStock ?? 0, // currentStock unchanged; reservedStock updated
          referenceType: "partsRequest",
          referenceId: requestId,
          notes: `Reserved for parts request ${requestId}`,
          performedBy: callerUid,
          performedAt: now,
          createdAt: now,
        });
      }

      // Update partsRequest status
      tx.update(requestRef, {
        status: "parts_reserved",
        reservedAt: now,
        reservedBy: callerUid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    });

    logger.info(`reserveStock: reserved parts for request ${requestId}`);
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error(`reserveStock failed for ${requestId}`, err);
    throw new HttpsError("internal", "Failed to reserve stock");
  }
});
