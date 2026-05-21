const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {db, FieldValue, Timestamp, normalizeStatus, addNotification, logger} = require("./shared");

async function resolveLinkedWatchFlags(ticketId, ticket) {
  const companyId = ticket.companyId || ticket.siteId;
  if (!companyId) return;
  const handoversSnap = await db
      .collection("shift_handovers")
      .where("companyId", "==", companyId)
      .where("status", "in", ["pending_acceptance", "accepted"])
      .get();

  let resolved = 0;
  await Promise.all(handoversSnap.docs.map(async (handoverDoc) => {
    const handover = handoverDoc.data();
    let changed = false;
    const watchFlags = (handover.watchFlags || []).map((flag) => {
      if (flag.linkedBreakdownId === ticketId && flag.status !== "resolved") {
        changed = true;
        resolved += 1;
        return {
          ...flag,
          status: "resolved",
          resolvedAt: Timestamp.now(),
          resolvedBy: ticket.closedBy || ticket.resolvedBy || null,
        };
      }
      return flag;
    });
    if (changed) {
      await handoverDoc.ref.update({watchFlags, updatedAt: FieldValue.serverTimestamp()});
    }
  }));

  if (resolved > 0) {
    await addNotification(companyId, {
      type: "watch_flag_resolved",
      title: "Watch flag resolved",
      body: `${resolved} watch flag(s) resolved when breakdown ${ticket.ticketNumber || ticketId} closed.`,
      targetRoles: ["supervisor", "admin"],
      ticketId,
    });
    logger.info("Resolved linked watch flags", {ticketId, resolved});
  }
}

exports.resolveWatchFlagOnTicketClose = onDocumentUpdated({ database: "default", document: "breakdown_tickets/{ticketId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (normalizeStatus(before.status || before.currentState) === normalizeStatus(after.status || after.currentState)) return;
  if (!["closed", "resolved"].includes(normalizeStatus(after.status || after.currentState))) return;
  await resolveLinkedWatchFlags(event.params.ticketId, after);
});

exports.resolveWatchFlagOnBreakdownClose = onDocumentUpdated({ database: "default", document: "breakdowns/{ticketId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (normalizeStatus(before.status || before.currentState) === normalizeStatus(after.status || after.currentState)) return;
  if (!["closed", "resolved"].includes(normalizeStatus(after.status || after.currentState))) return;
  await resolveLinkedWatchFlags(event.params.ticketId, after);
});
