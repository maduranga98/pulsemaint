const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db, Timestamp, requireAuth, addNotification} = require("./shared");

function shiftDate(date) {
  return date.toISOString().slice(0, 10);
}

function withWatchFlagDefaults(flag, index) {
  return {
    id: flag.id || `watch_${Date.now()}_${index}`,
    machineId: flag.machineId || "",
    machineName: flag.machineName || "",
    machineLocation: flag.machineLocation || "",
    watchLevel: flag.watchLevel || "monitor",
    reason: flag.reason || "",
    recommendedAction: flag.recommendedAction || "",
    linkedBreakdownId: flag.linkedBreakdownId || null,
    status: flag.status || "active",
    resolvedAt: null,
    resolvedBy: null,
    carriedFromHandoverId: flag.carriedFromHandoverId || null,
  };
}

exports.submitHandover = onCall(async (request) => {
  requireAuth(request);
  const {
    companyId,
    draft,
    stats,
    outgoingSupervisorId,
    outgoingSupervisorName,
    outgoingSupervisorDesignation,
  } = request.data || {};

  if (!companyId || !draft || !stats || !outgoingSupervisorId) {
    throw new HttpsError("invalid-argument", "companyId, draft, stats and outgoingSupervisorId are required.");
  }
  if (!draft.outgoingAcknowledged) {
    throw new HttpsError("failed-precondition", "Outgoing supervisor acknowledgement is required.");
  }

  const submittedAt = Timestamp.now();
  const start = draft.shiftActualStart ? Timestamp.fromDate(new Date(draft.shiftActualStart)) : submittedAt;
  const handoverRef = db.collection("shift_handovers").doc();
  const handover = {
    id: handoverRef.id,
    companyId,
    shiftConfigId: draft.shiftConfigId || "",
    shiftName: draft.shiftName || "Current Shift",
    shiftDate: shiftDate(start.toDate()),
    outgoingSupervisorId,
    outgoingSupervisorName: outgoingSupervisorName || "Supervisor",
    outgoingSupervisorDesignation: outgoingSupervisorDesignation || null,
    shiftActualStart: start,
    handoverSubmittedAt: submittedAt,
    incomingSupervisorId: null,
    incomingSupervisorName: null,
    incomingSupervisorDesignation: null,
    handoverAcceptedAt: null,
    overlapMinutes: null,
    stats,
    watchFlags: (draft.watchFlags || []).map(withWatchFlagDefaults),
    pendingWOs: draft.pendingWOs || [],
    ongoingBreakdowns: draft.ongoingBreakdowns || [],
    partsNotes: draft.partsNotes || "",
    lowStockAlerts: draft.lowStockAlerts || [],
    safetyIncidentOccurred: Boolean(draft.safetyIncidentOccurred),
    safetyIncidentDescription: draft.safetyIncidentOccurred ? draft.safetyIncidentDescription || "" : null,
    restrictedAreas: draft.restrictedAreas || null,
    temporaryRepairs: draft.temporaryRepairs || null,
    generalNotes: draft.generalNotes || "",
    outgoingAcknowledged: true,
    incomingAcknowledged: false,
    status: "pending_acceptance",
    createdAt: submittedAt,
    updatedAt: submittedAt,
  };

  const statRef = db.collection("shift_stats").doc();
  const statDate = start.toDate();
  const batch = db.batch();
  batch.set(handoverRef, handover);
  batch.set(statRef, {
    id: statRef.id,
    companyId,
    shiftId: handover.shiftConfigId,
    shiftName: handover.shiftName,
    date: handover.shiftDate,
    dayOfWeek: statDate.toLocaleDateString("en-US", {weekday: "short"}),
    outgoingSupervisorId,
    incomingSupervisorId: null,
    shiftStart: handover.shiftActualStart,
    shiftEnd: null,
    handoverSubmittedAt: submittedAt,
    handoverAcceptedAt: null,
    overlapMinutes: null,
    breakdownsOpened: stats.breakdownsOpened || 0,
    breakdownsClosed: stats.breakdownsClosed || 0,
    breakdownsCarriedOver: stats.breakdownsCarriedOver || 0,
    criticalBreakdowns: stats.criticalBreakdowns || 0,
    highBreakdowns: stats.highBreakdowns || 0,
    wosOpened: stats.wosOpened || 0,
    wosCompleted: stats.wosCompleted || 0,
    wosPending: stats.wosPending || 0,
    pmsCompleted: stats.pmsCompleted || 0,
    pmsMissed: stats.pmsMissed || 0,
    partsIssued: stats.partsIssued || 0,
    partsValue: stats.partsIssuedValue || 0,
    productionHoursLost: stats.productionHoursLost || 0,
    watchFlagsRaised: handover.watchFlags.length,
    watchFlagsResolved: 0,
    safetyIncidents: handover.safetyIncidentOccurred ? 1 : 0,
    month: statDate.getMonth() + 1,
    year: statDate.getFullYear(),
    week: Math.ceil((((statDate - new Date(statDate.getFullYear(), 0, 1)) / 86400000) + new Date(statDate.getFullYear(), 0, 1).getDay() + 1) / 7),
    createdAt: submittedAt,
    updatedAt: submittedAt,
  });
  await batch.commit();

  await addNotification(companyId, {
    type: "shift_handover_submitted",
    title: `Incoming shift briefing - ${handover.shiftName}`,
    body: `${handover.outgoingSupervisorName} submitted a handover for review.`,
    targetRoles: ["supervisor", "admin"],
    handoverId: handoverRef.id,
  });

  if (handover.watchFlags.some((flag) => flag.watchLevel === "critical_watch")) {
    await addNotification(companyId, {
      type: "critical_watch_flag",
      title: "Critical watch machine in shift handover",
      body: "Review the incoming shift briefing before taking responsibility.",
      targetRoles: ["supervisor", "admin"],
      handoverId: handoverRef.id,
      channel: ["push", "sms"],
    });
  }

  if (handover.safetyIncidentOccurred) {
    await addNotification(companyId, {
      type: "handover_safety_incident",
      title: "Safety incident reported in handover",
      body: handover.safetyIncidentDescription || "A safety incident was reported.",
      targetRoles: ["plant_manager", "hr_officer", "admin"],
      handoverId: handoverRef.id,
      channel: ["push", "email"],
    });
  }

  return {handoverId: handoverRef.id};
});
