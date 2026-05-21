const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db, FieldValue, Timestamp, addNotification, logger } = require("./shared");

exports.checkUnacceptedHandovers = onSchedule("every 30 minutes", async () => {
  const now = Date.now();
  const cutoff = Timestamp.fromMillis(now - 30 * 60 * 1000);
  const snap = await db
    .collection("shift_handovers")
    .where("status", "==", "pending_acceptance")
    .where("handoverSubmittedAt", "<=", cutoff)
    .get();

  await Promise.all(snap.docs.map(async (doc) => {
    const handover = doc.data();
    const submittedAt = handover.handoverSubmittedAt?.toMillis ? handover.handoverSubmittedAt.toMillis() : now;
    const ageMinutes = Math.round((now - submittedAt) / 60000);
    const level = ageMinutes >= 60 ? "handover_unaccepted_60" : "handover_unaccepted_30";

    await addNotification(handover.companyId, {
      type: level,
      title: ageMinutes >= 60 ? "Shift handover escalation" : "Shift handover not accepted",
      body: `${handover.shiftName} handover has been pending for ${ageMinutes} minutes.`,
      targetRoles: ageMinutes >= 60 ? ["plant_manager", "admin"] : ["plant_manager"],
      handoverId: doc.id,
      channel: ["push", "sms"],
    });

    if (ageMinutes >= 60 && !handover.escalationTicketId) {
      const ticketRef = await db.collection("escalationTickets").add({
        companyId: handover.companyId,
        source: "shift_handover",
        handoverId: doc.id,
        title: `Unaccepted handover - ${handover.shiftName}`,
        status: "open",
        severity: "high",
        createdAt: FieldValue.serverTimestamp(),
      });
      await doc.ref.update({ escalationTicketId: ticketRef.id, updatedAt: FieldValue.serverTimestamp() });
    }
  }));

  logger.info("Checked unaccepted handovers", { count: snap.size });
});
