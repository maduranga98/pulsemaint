const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {db, FieldValue, logger} = require("./shared");

exports.carryForwardWatchFlags = onDocumentCreated({ database: "default", document: "shift_handovers/{handoverId}" }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const handover = snap.data();
  const existingIds = new Set((handover.watchFlags || []).map((flag) => flag.id));

  const previousSnap = await db
      .collection("shift_handovers")
      .where("companyId", "==", handover.companyId)
      .where("handoverSubmittedAt", "<", handover.handoverSubmittedAt)
      .orderBy("handoverSubmittedAt", "desc")
      .limit(5)
      .get();

  const carried = [];
  previousSnap.docs.forEach((doc) => {
    (doc.data().watchFlags || []).forEach((flag) => {
      if (["active", "carried_forward"].includes(flag.status) && !existingIds.has(flag.id)) {
        carried.push({
          ...flag,
          id: `${flag.id}_cf_${event.params.handoverId}`,
          status: "carried_forward",
          carriedFromHandoverId: flag.carriedFromHandoverId || doc.id,
        });
      }
    });
  });

  if (!carried.length) return;
  await snap.ref.update({
    watchFlags: [...(handover.watchFlags || []), ...carried],
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info("Carried forward watch flags", {handoverId: event.params.handoverId, count: carried.length});
});
