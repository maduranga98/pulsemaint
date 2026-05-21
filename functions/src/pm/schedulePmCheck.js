/**
 * schedulePmCheck
 * Runs daily at 6:00 AM via Cloud Scheduler.
 *
 * 1. Queries all active PM schedules where nextDueDate <= today
 * 2. For each due schedule:
 *    - Auto-generates PM Work Order in workOrders collection
 *    - Sends push + email notification to assigned technicians and supervisor
 *    - Updates schedule's nextDueDate to next occurrence
 *    - Creates entry in pm_history with status = 'in_progress'
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
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

function calculateNextDueDate(fromDate, recurrenceType, customIntervalDays) {
  const next = new Date(fromDate);
  switch (recurrenceType) {
    case "daily": next.setDate(next.getDate() + 1); break;
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "biweekly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
    case "semi_annual": next.setMonth(next.getMonth() + 6); break;
    case "annual": next.setFullYear(next.getFullYear() + 1); break;
    case "custom":
      if (customIntervalDays) next.setDate(next.getDate() + customIntervalDays);
      break;
  }
  return next;
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

exports.schedulePmCheck = onSchedule({schedule: "0 6 * * *", timeZone: "Asia/Colombo"}, async () => {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  try {
    const schedulesSnap = await db
        .collection("pm_schedules")
        .where("status", "==", "active")
        .where("triggerType", "==", "calendar")
        .where("nextDueDate", "<=", Timestamp.fromDate(todayEnd))
        .get();

    logger.info(`schedulePmCheck: ${schedulesSnap.size} schedules due`);

    for (const docSnap of schedulesSnap.docs) {
      const schedule = docSnap.data();
      const scheduleId = docSnap.id;
      const companyId = schedule.companyId;

      try {
        // Generate WO number
        const year = now.getFullYear();
        const woNumber = await generateWONumber(companyId, year);

        // Create Work Order
        const woRef = db.collection("workOrders").doc();
        const woData = {
          siteId: companyId,
          woType: "PREVENTIVE",
          priority: schedule.priority,
          status: "OPEN",
          description: schedule.description || `${schedule.name} — Preventive Maintenance`,
          dueDate: schedule.nextDueDate,
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
          supervisorInChargeId: schedule.createdBy,
          supervisorInChargeName: "Supervisor",
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
            uploadedBy: schedule.createdBy,
            uploadedByName: "System",
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
            changedBy: "system",
            changedByName: "System",
            changedAt: FieldValue.serverTimestamp(),
            note: "Auto-generated from PM schedule",
          }],
          createdBy: "system",
          createdByName: "System",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          closedAt: null,
          cancelledAt: null,
          cancelReason: null,
        };

        await woRef.set(woData);

        // Create pm_history entry
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        await db.collection("pm_history").add({
          companyId,
          scheduleId,
          scheduleName: schedule.name,
          machineId: schedule.machineId,
          machineName: schedule.machineName,
          woId: woRef.id,
          woNumber,
          dueDate: schedule.nextDueDate,
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

        // Calculate next due date
        const nextDue = calculateNextDueDate(
            schedule.nextDueDate.toDate(),
            schedule.recurrenceType,
            schedule.customIntervalDays,
        );

        // Update schedule
        await docSnap.ref.update({
          nextDueDate: Timestamp.fromDate(nextDue),
          lastWoGeneratedAt: FieldValue.serverTimestamp(),
          lastWoId: woRef.id,
          totalScheduled: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Send notifications
        await sendPushToUsers(
            schedule.assignedTechnicianIds,
            "New PM Work Order",
            `${woNumber} — ${schedule.machineName}`,
            {woId: woRef.id, woNumber, scheduleId, screen: "WODetail"},
        );

        logger.info(`PM WO created: ${woNumber} for schedule ${scheduleId}`);
      } catch (innerErr) {
        logger.error(`Failed to process schedule ${scheduleId}`, innerErr);
      }
    }
  } catch (err) {
    logger.error("schedulePmCheck failed", err);
  }
});
