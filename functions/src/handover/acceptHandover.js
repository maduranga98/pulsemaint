const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db, FieldValue, Timestamp, minutesBetween, requireAuth, addNotification} = require("./shared");

exports.acceptHandover = onCall(async (request) => {
  requireAuth(request);
  const {handoverId, companyId} = request.data || {};
  if (!handoverId || !companyId) {
    throw new HttpsError("invalid-argument", "handoverId and companyId are required.");
  }

  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  const user = userSnap.exists ? userSnap.data() : {};
  const handoverRef = db.collection("shift_handovers").doc(handoverId);
  const handoverSnap = await handoverRef.get();
  if (!handoverSnap.exists) throw new HttpsError("not-found", "Handover not found.");
  const handover = handoverSnap.data();
  if (handover.companyId !== companyId) throw new HttpsError("permission-denied", "Company mismatch.");
  if (handover.status !== "pending_acceptance") {
    throw new HttpsError("failed-precondition", "Handover has already been accepted or archived.");
  }

  const acceptedAt = Timestamp.now();
  const overlapMinutes = minutesBetween(handover.handoverSubmittedAt, acceptedAt);
  await handoverRef.update({
    incomingSupervisorId: request.auth.uid,
    incomingSupervisorName: user.fullName || user.displayName || user.email || "Incoming Supervisor",
    handoverAcceptedAt: acceptedAt,
    overlapMinutes,
    incomingAcknowledged: true,
    status: "accepted",
    updatedAt: acceptedAt,
  });

  const statsSnap = await db
      .collection("shift_stats")
      .where("companyId", "==", companyId)
      .where("handoverSubmittedAt", "==", handover.handoverSubmittedAt)
      .limit(1)
      .get();
  if (!statsSnap.empty) {
    await statsSnap.docs[0].ref.update({
      incomingSupervisorId: request.auth.uid,
      handoverAcceptedAt: acceptedAt,
      overlapMinutes,
      updatedAt: acceptedAt,
    });
  }

  await db.collection("auditLogs").add({
    companyId,
    action: "shift_handover_accepted",
    actorId: request.auth.uid,
    handoverId,
    outgoingSupervisorId: handover.outgoingSupervisorId,
    createdAt: FieldValue.serverTimestamp(),
  });

  await addNotification(companyId, {
    type: "shift_handover_accepted",
    title: "Shift handover accepted",
    body: `${user.fullName || "Incoming supervisor"} accepted ${handover.shiftName}.`,
    targetUserIds: [handover.outgoingSupervisorId],
    handoverId,
  });

  return {success: true};
});
