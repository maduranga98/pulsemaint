/**
 * autoUpdateWoPartsOnClose
 * Firestore onUpdate trigger on workOrders/{woId}
 *
 * When a work order status changes to 'closed' (or 'CLOSED'):
 *   1. Find all partsRequests for this WO where status='issued'
 *   2. For each request, compare quantityIssued vs quantityUsed (from WO partsUsed)
 *   3. If any parts were unused, trigger confirmPartsReturn logic inline
 *      (returns unused qty to stock, creates return stockMovements)
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore();

const CLOSED_STATUSES = ["closed", "CLOSED", "SIGNED_OFF"];

exports.autoUpdateWoPartsOnClose = onDocumentUpdated(
  "workOrders/{woId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const woId = event.params.woId;

    if (!before || !after) return;

    const wasClosedBefore = CLOSED_STATUSES.includes(before.status);
    const isClosedNow = CLOSED_STATUSES.includes(after.status);

    // Only act on the transition to closed
    if (wasClosedBefore || !isClosedNow) return;

    const companyId = after.companyId;
    if (!companyId) {
      logger.warn(`autoUpdateWoPartsOnClose: workOrder ${woId} has no companyId`);
      return;
    }

    try {
      // Find issued partsRequests linked to this WO
      const partsRequestsSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("partsRequests")
        .where("workOrderId", "==", woId)
        .where("status", "==", "issued")
        .get();

      if (partsRequestsSnap.empty) {
        logger.info(`autoUpdateWoPartsOnClose: no issued partsRequests for WO ${woId}`);
        return;
      }

      // Build a map of actuallyUsed parts from the WO's partsUsed array
      const partsUsed = after.partsUsed ?? [];
      const usedMap = {};
      for (const p of partsUsed) {
        if (p.partId) {
          usedMap[p.partId] = (usedMap[p.partId] ?? 0) + (p.quantity ?? 0);
        }
      }

      const now = Timestamp.now();

      for (const requestDoc of partsRequestsSnap.docs) {
        const partsRequest = requestDoc.data();
        const requestId = requestDoc.id;
        const items = partsRequest.items ?? [];

        const returnedItems = [];

        for (const item of items) {
          const partId = item.partId;
          const quantityIssued = item.quantityIssued ?? item.quantityApproved ?? item.quantityRequested ?? 0;
          const quantityUsed = usedMap[partId] ?? 0;
          const quantityToReturn = Math.max(0, quantityIssued - quantityUsed);

          if (quantityToReturn > 0) {
            returnedItems.push({ partId, itemId: item.itemId ?? partId, quantityReturned: quantityToReturn });
          }
        }

        if (!returnedItems.length) {
          // Nothing to return — just mark as completed
          await requestDoc.ref.update({
            status: "completed",
            returnedAt: now,
            returnedBy: "system",
            notes: (partsRequest.notes ?? "") + " | Auto-completed on WO close (no unused parts)",
            updatedAt: FieldValue.serverTimestamp(),
          });
          continue;
        }

        // Run transaction for each request
        await db.runTransaction(async (tx) => {
          for (const returned of returnedItems) {
            const { partId, quantityReturned } = returned;
            const qty = Number(quantityReturned) || 0;
            if (qty <= 0) continue;

            const partRef = db
              .collection("companies")
              .doc(companyId)
              .collection("inventoryParts")
              .doc(partId);
            const partSnap = await tx.get(partRef);

            if (!partSnap.exists) {
              logger.warn(`autoUpdateWoPartsOnClose: part ${partId} not found, skipping`);
              continue;
            }

            const part = partSnap.data();

            tx.update(partRef, {
              currentStock: FieldValue.increment(qty),
              lastReceivedAt: now,
              updatedAt: FieldValue.serverTimestamp(),
            });

            const movementRef = db
              .collection("companies")
              .doc(companyId)
              .collection("stockMovements")
              .doc();
            tx.set(movementRef, {
              companyId,
              partId,
              partName: part.partName ?? "",
              partNumber: part.partNumber ?? "",
              movementType: "return",
              quantity: qty,
              quantityBefore: part.currentStock ?? 0,
              quantityAfter: (part.currentStock ?? 0) + qty,
              referenceType: "workOrder",
              referenceId: woId,
              notes: `Auto-return on WO close — unused parts from request ${requestId}`,
              performedBy: "system",
              performedAt: now,
              createdAt: now,
            });
          }

          tx.update(requestDoc.ref, {
            status: "completed",
            returnedAt: now,
            returnedBy: "system",
            returnedItems,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        logger.info(
          `autoUpdateWoPartsOnClose: returned ${returnedItems.length} item(s) from request ${requestId} on WO close`,
        );
      }
    } catch (err) {
      logger.error(`autoUpdateWoPartsOnClose failed for WO ${woId}`, err);
    }
  },
);
