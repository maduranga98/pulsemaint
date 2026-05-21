/**
 * triggerManualPM
 * Callable function for supervisors to manually trigger a PM Work Order.
 *
 * Input: { scheduleId }
 * 1. Validates the schedule exists and is active
 * 2. Creates a PM Work Order immediately
 * 3. Creates pm_history entry
 * 4. Returns { woId, woNumber }
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

async function generateWONumber(siteId, year) {
  const counterRef = db.collection("woCounters").doc(`${siteId}_${year}`);
  const snap = await counterRef.get();

  let nextSeq = 1;
  if (snap.exists) {
    nextSeq = (snap.data().lastSequence || 0) + 1;
    await counterRef.update({lastSequence: nextSeq});
  } else {
    await counterRef.set({siteId, year, lastSequence: nextSeq});
  }

  return `WO-${year}-${String(nextSeq).padStart(4, "0")}`;
}

async function sendPushToUsers(userIds, title, body, data = {}) {
  const tokens = [];
  for (const uid of userIds) {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const token = userDoc.data().fcmToken;
      if (token) tokens.push(token);
    }
  }
  if (!tokens.length) return;
  try {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {title, body},
      data: {...data},
    });
  } catch (err) {
    logger.error("FCM multicast failed", err);
  }
}

exports.triggerManualPM = onCall({cors: true}, async (request) => {
  const {scheduleId} = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!scheduleId) {
    throw new HttpsError("invalid-argument", "scheduleId is required");
  }

  try {
    const scheduleRef = db.collection("pm_schedules").doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      throw new HttpsError("not-found", "PM schedule not found");
    }

    const schedule = scheduleSnap.data();

    if (schedule.status !== "active") {
      throw new HttpsError("failed-precondition", "PM schedule is not active");
    }

    const now = new Date();
    const year = now.getFullYear();
    const woNumber = await generateWONumber(schedule.companyId, year);

    const woRef = db.collection("workOrders").doc();
    const woData = {
      siteId: schedule.companyId,
      woType: "PREVENTIVE",
      priority: schedule.priority,
      status: "OPEN",
      description: schedule.description || `${schedule.name} — Manual PM Trigger`,
      dueDate: Timestamp.fromDate(now),
      slaDeadline: Timestamp.fromDate(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      slaBreached: false,
      machineId: schedule.machineId,
      machineName: schedule.machineName,
      machineDepartment: schedule.department,
      machineLocation: schedule.location,
      machineType: "",
      machineCriticality: schedule.machineCriticality,
      linkedBreakdownId: null,
      linkedBreakdownTicketNumber: null,
      supervisorInChargeId: auth.uid,
      supervisorInChargeName: auth.token.name || "Supervisor",
      assignedTechnicianIds: schedule.assignedTechnicianIds,
      assignedTechnicianNames: schedule.assignedTechnicianNames,
      contractorCompanyId: null,
      contractorCompanyName: null,
      contractorContactPerson: null,
      contractorContactNumber: null,
      contractorTechnicianNames: [],
      isManualContractor: false,
      checklist: (schedule.checklistItems || []).map((item) => ({
        stepNumber: item.step,
        stepDescription: item.description,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        estimatedMinutes: item.estimatedMinutes,
        isCompleted: false,
        completedBy: null,
        completedByName: null,
        completedAt: null,
      })),
      documents: (schedule.documents || []).map((d) => ({
        id: `doc-${Date.now()}`,
        name: d.name,
        fileType: "document",
        format: d.type,
        url: d.url,
        storagePath: "",
        fileSize: d.size,
        uploadedBy: auth.uid,
        uploadedByName: auth.token.name || "Supervisor",
        uploadedAt: FieldValue.serverTimestamp(),
        isCompletionDocument: false,
      })),
      partsRequests: [],
      actualStartTime: null,
      actualEndTime: null,
      totalDurationMinutes: null,
      workDoneDescription: null,
      rootCause: null,
      rootCauseDescription: null,
      partsUsed: [],
      technicianWorkLogs: [],
      contractorHoursLog: null,
      postRepairChecklist: [],
      testRunResult: null,
      testRunNotes: null,
      finalPhotos: [],
      machineStatusAfterRepair: null,
      supervisorSignOffSignature: null,
      supervisorSignOffBy: null,
      supervisorSignOffAt: null,
      supervisorSignOffNotes: null,
      statusHistory: [{
        status: "OPEN",
        changedBy: auth.uid,
        changedByName: auth.token.name || "Supervisor",
        changedAt: FieldValue.serverTimestamp(),
        note: "Manually triggered from PM schedule",
      }],
      createdBy: auth.uid,
      createdByName: auth.token.name || "Supervisor",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      closedAt: null,
      cancelledAt: null,
      cancelReason: null,
    };

    await woRef.set(woData);

    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await db.collection("pm_history").add({
      companyId: schedule.companyId,
      scheduleId,
      scheduleName: schedule.name,
      machineId: schedule.machineId,
      machineName: schedule.machineName,
      woId: woRef.id,
      woNumber,
      dueDate: Timestamp.fromDate(now),
      completedDate: null,
      status: "in_progress",
      daysOverdue: 0,
      technicianIds: schedule.assignedTechnicianIds,
      technicianNames: schedule.assignedTechnicianNames,
      duration: null,
      month: monthKey,
      year: now.getFullYear(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Send notifications
    await sendPushToUsers(
        schedule.assignedTechnicianIds,
        "Manual PM Work Order",
        `${woNumber} — ${schedule.machineName}`,
        {woId: woRef.id, woNumber, scheduleId, screen: "WODetail"},
    );

    logger.info(`Manual PM triggered: ${woNumber} for schedule ${scheduleId}`);

    return {woId: woRef.id, woNumber};
  } catch (err) {
    logger.error("triggerManualPM failed", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message || "Failed to trigger manual PM");
  }
});
