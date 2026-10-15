/**
 * Raises one PM work order from a PM schedule — the single path used by the
 * daily scheduler (schedulePmCheck), the "Trigger now" button
 * (triggerManualPM) and usage-based schedules (onPmMeterUpdated).
 *
 * In one transaction it takes the next work-order number, creates the work
 * order (linked to its schedule and PM history record, with companyId and the
 * machine's current plant), creates the pm_history record the PM compliance
 * figures are built from, and advances the schedule — so a number is never
 * consumed without a work order, and a retried run can't raise the same
 * occurrence twice.
 */

const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");
const {toDate, usageState, DEFAULT_AUTO_CLOSE_DAYS, DEFAULT_ESCALATION_HOURS} = require("./pmScheduling");

const db = getFirestore("default");

const OPEN_WO_STATUSES = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_APPROVAL", "ON_HOLD"]);

/**
 * Reserves the next work-order number inside a transaction (same counter
 * document and format as onWOCreated's generateWONumber).
 * @param {object} tx transaction
 * @param {string} companyId company / site id
 * @param {number} year year
 * @return {Promise<{ref: object, next: number, exists: boolean, number: string}>} reservation
 */
async function readWoCounter(tx, companyId, year) {
  const ref = db.collection("woCounters").doc(`${companyId}_${year}`);
  const snap = await tx.get(ref);
  const next = (snap.exists ? Number(snap.data().lastSequence) || 0 : 0) + 1;
  return {ref, next, exists: snap.exists, number: `WO-${year}-${String(next).padStart(4, "0")}`};
}

/**
 * @param {object} params
 * @param {string} params.scheduleId pm_schedules id
 * @param {'schedule'|'manual'|'usage'} params.source what raised it
 * @param {Date} params.dueDate the occurrence's due date
 * @param {Date|null} [params.nextDueDate] calendar runs: the schedule's next due date (null → schedule completes)
 * @param {number} [params.expectedNextDueMs] calendar runs: nextDueDate the plan was made from (idempotency)
 * @param {number} [params.skipped] calendar runs: occurrences skipped while catching up
 * @param {{uid: string, name: string|null}|null} [params.actor] manual trigger: who pressed it
 * @return {Promise<{woId: string, woNumber: string, schedule: object}|null>} null when nothing was raised
 */
async function generatePmWorkOrder(params) {
  const {scheduleId, source, dueDate, actor = null} = params;
  const scheduleRef = db.collection("pm_schedules").doc(scheduleId);
  const woRef = db.collection("workOrders").doc();
  const historyRef = db.collection("pm_history").doc();
  const now = new Date();
  const nowTs = Timestamp.fromDate(now);

  const result = await db.runTransaction(async (tx) => {
    const scheduleSnap = await tx.get(scheduleRef);
    if (!scheduleSnap.exists) return null;
    const schedule = scheduleSnap.data();
    const companyId = schedule.companyId;
    if (!companyId || schedule.status !== "active") return null;

    if (source === "schedule") {
      // Another run already handled this occurrence (or the schedule was edited).
      const current = toDate(schedule.nextDueDate);
      if (!current || current.getTime() !== params.expectedNextDueMs) return null;
    }
    if (source === "usage") {
      if (schedule.triggerType !== "usage" || !usageState(schedule).due) return null;
    }
    if (source === "usage" && schedule.lastWoId) {
      // One open usage work order at a time.
      const lastWo = await tx.get(db.collection("workOrders").doc(String(schedule.lastWoId)));
      if (lastWo.exists && OPEN_WO_STATUSES.has(lastWo.data().status)) return null;
    }

    const machineSnap = schedule.machineId ?
      await tx.get(db.collection("machines").doc(String(schedule.machineId))) :
      null;
    const machine = machineSnap && machineSnap.exists ? machineSnap.data() : {};
    const supervisorId = schedule.supervisorInChargeId || schedule.createdBy || null;
    let supervisorName = schedule.supervisorInChargeName || null;
    if (!supervisorName && supervisorId) {
      const sup = await tx.get(db.doc(`companies/${companyId}/users/${supervisorId}`));
      supervisorName = sup.exists ? sup.data().fullName || null : null;
    }
    const counter = await readWoCounter(tx, companyId, now.getUTCFullYear());

    const plantId = machine.plantId ?? schedule.plantId ?? null;
    const department = machine.department ?? schedule.department ?? null;
    const dueTs = Timestamp.fromDate(dueDate);
    const actorId = actor ? actor.uid : "system";
    const actorName = actor ? actor.name || "Supervisor" : "System";
    const note = source === "manual" ?
      "Manually triggered from PM schedule" :
      source === "usage" ?
        "Auto-generated: usage meter reached the PM threshold" :
        "Auto-generated from PM schedule";

    tx.set(woRef, {
      companyId,
      siteId: companyId,
      woNumber: counter.number,
      // onWOCreated keeps a number issued here instead of taking another one.
      woNumberIssuedBy: "server",
      woType: "PREVENTIVE",
      pmType: schedule.pmType || null,
      priority: schedule.priority || "medium",
      status: "OPEN",
      description: schedule.description || `${schedule.name} — Preventive Maintenance`,
      dueDate: dueTs,
      slaDeadline: null,
      slaBreached: false,
      machineId: schedule.machineId || null,
      machineName: machine.name || schedule.machineName || "",
      machineDepartment: department,
      machinePlantId: plantId,
      machineLocation: schedule.location || null,
      machineType: machine.type || "",
      machineCriticality: machine.criticality ?? schedule.machineCriticality ?? null,
      linkedBreakdownId: null,
      linkedBreakdownTicketNumber: null,
      pmScheduleId: scheduleId,
      pmHistoryId: historyRef.id,
      supervisorInChargeId: supervisorId,
      supervisorInChargeName: supervisorName,
      assignedTechnicianIds: schedule.assignedTechnicianIds || [],
      assignedTechnicianNames: schedule.assignedTechnicianNames || [],
      contractorCompanyId: null,
      contractorCompanyName: schedule.contractorCompanyName || null,
      contractorContactPerson: null,
      contractorContactNumber: null,
      contractorTechnicianNames: schedule.contractorTechnicianNames || [],
      isManualContractor: false,
      checklist: (schedule.checklistItems || []).map((item, i) => ({
        stepNumber: item.step ?? i + 1,
        stepDescription: item.description || "",
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        assignedTechnicianIds: [],
        assignedTechnicianNames: [],
        estimatedMinutes: item.estimatedMinutes ?? null,
        estimatedDurationUnit: "minutes",
        isCompleted: false,
        completedBy: null,
        completedByName: null,
        completedAt: null,
        inputType: item.inputType === "measurement" ? "measurement" : "checkbox",
        method: item.method ?? null,
        unit: item.unit ?? null,
        acceptableMin: item.acceptableMin ?? null,
        acceptableMax: item.acceptableMax ?? null,
        actualValue: null,
        result: null,
        repairNote: null,
      })),
      // Firestore rejects serverTimestamp() inside arrays, which is why PM
      // work orders never got created before — use a concrete time.
      documents: (schedule.documents || []).map((d, i) => ({
        id: `doc-${now.getTime()}-${i}`,
        name: d.name || "",
        fileType: "document",
        format: d.type || "",
        url: d.url || "",
        storagePath: d.storagePath || "",
        fileSize: d.size ?? null,
        uploadedBy: schedule.createdBy || actorId,
        uploadedByName: "System",
        uploadedAt: nowTs,
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
      statusHistory: [{status: "OPEN", changedBy: actorId, changedByName: actorName, changedAt: nowTs, note}],
      createdBy: actorId,
      createdByName: actorName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      closedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });

    tx.set(historyRef, {
      companyId,
      scheduleId,
      scheduleName: schedule.name || "",
      machineId: schedule.machineId || null,
      machineName: machine.name || schedule.machineName || "",
      machinePlantId: plantId,
      machineDepartment: department,
      woId: woRef.id,
      woNumber: counter.number,
      dueDate: dueTs,
      completedDate: null,
      status: "in_progress",
      daysOverdue: 0,
      technicianIds: schedule.assignedTechnicianIds || [],
      technicianNames: schedule.assignedTechnicianNames || [],
      duration: null,
      // Compliance is reported by the month the PM fell due.
      month: `${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth() + 1).padStart(2, "0")}`,
      year: dueDate.getUTCFullYear(),
      // checkPmOverdue escalates / marks missed using the schedule's own settings.
      overdueEscalationHours: Number(schedule.overdueEscalationHours) > 0 ?
        Number(schedule.overdueEscalationHours) :
        DEFAULT_ESCALATION_HOURS,
      autoCloseAfterDays: Number(schedule.autoCloseAfterDays) > 0 ? Number(schedule.autoCloseAfterDays) : DEFAULT_AUTO_CLOSE_DAYS,
      triggerSource: source,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (counter.exists) tx.update(counter.ref, {lastSequence: counter.next});
    else tx.set(counter.ref, {siteId: companyId, year: now.getUTCFullYear(), lastSequence: counter.next});

    const scheduleUpdate = {
      lastWoId: woRef.id,
      lastWoGeneratedAt: FieldValue.serverTimestamp(),
      activeWoId: woRef.id,
      activeWoStatus: "OPEN",
      totalScheduled: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (source === "schedule") {
      if (params.nextDueDate) {
        scheduleUpdate.nextDueDate = Timestamp.fromDate(params.nextDueDate);
      } else {
        scheduleUpdate.status = "completed";
      }
      if (params.skipped) scheduleUpdate.skippedOccurrences = FieldValue.increment(params.skipped);
    }
    if (source === "usage") scheduleUpdate.usageBaselineValue = Number(schedule.currentMeterValue);
    tx.update(scheduleRef, scheduleUpdate);

    return {
      woId: woRef.id,
      woNumber: counter.number,
      schedule: {...schedule, machineName: machine.name || schedule.machineName, plantId, department},
    };
  });

  if (result) {
    await notifyPmRaised(result.schedule, result.woNumber, result.woId, dueDate, source).catch((err) =>
      logger.error("PM work order notification failed", {scheduleId, err}),
    );
  }
  return result;
}

/** Push to the assigned technicians + an in-app bell entry. */
async function notifyPmRaised(schedule, woNumber, woId, dueDate, source) {
  const techIds = schedule.assignedTechnicianIds || [];
  const tokens = [];
  for (const uid of techIds) {
    const snap = await db.collection("users").doc(uid).get();
    const token = snap.exists ? snap.data().fcmToken : null;
    if (token) tokens.push(token);
  }
  if (tokens.length) {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {title: source === "manual" ? "Manual PM Work Order" : "New PM Work Order", body: `${woNumber} — ${schedule.machineName}`},
      data: {woId, woNumber, screen: "WODetail"},
    }).catch((err) => logger.error("FCM multicast failed", err));
  }

  const userIds = [...new Set([...techIds, schedule.supervisorInChargeId].filter(Boolean))];
  let targetRoles = [];
  if (userIds.length === 0) targetRoles = ["technician", "supervisor"];
  else if (!schedule.supervisorInChargeId) targetRoles = ["supervisor"];
  const todayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const overdue = dueDate.getTime() < todayStart.getTime();
  const when = overdue ? "is overdue" : dueDate.getTime() < todayStart.getTime() + 86400000 ? "is due today" : `is due ${dueDate.toISOString().slice(0, 10)}`;
  await db.collection("notifications").add({
    companyId: schedule.companyId,
    type: "pm",
    message: `PM ${when}: "${schedule.name}" on ${schedule.machineName} (${woNumber})`,
    severity: overdue ? "high" : "medium",
    linkTo: `/app/work-orders?woId=${woId}`,
    timestamp: FieldValue.serverTimestamp(),
    read: false,
    readBy: [],
    recipientRoles: [...new Set([...targetRoles, "admin", "plant_manager"])],
    recipientUserIds: userIds,
    targetRoles,
    targetUserIds: userIds,
    actorName: null,
    actorRole: null,
    actorUserId: null,
    oversightMessage: null,
    plantId: schedule.plantId || null,
    department: schedule.department || null,
  });
}

module.exports = {generatePmWorkOrder, OPEN_WO_STATUSES};
