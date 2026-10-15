const { setGlobalOptions } = require("firebase-functions");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { initializeApp } = require("firebase-admin/app");
const logger = require("firebase-functions/logger");

initializeApp();
// Required after initializeApp(): it opens Firestore.
const { requireMember } = require("./src/lib/access");
// Per-function instance cap. At the default memory a 2nd-gen function serves
// one request per instance, so 10 meant 10 simultaneous requests per function
// across every company — callables failed and triggers backed up at the scale
// of 20-30 companies x ~500 users. Heavy/abuse-prone functions set their own
// lower caps (PDF rendering, email, the public QR lookup).
setGlobalOptions({ maxInstances: 100 });

const db = getFirestore("default");

// ---------------------------------------------------------------------------
// Inventory Module — Cloud Functions
// ---------------------------------------------------------------------------

const { processPartsRequest } = require("./src/inventory/processPartsRequest");
const { notifyLowStock, notifyLowStockOnCreate } = require("./src/inventory/notifyLowStock");
const { reserveStock } = require("./src/inventory/reserveStock");
const { confirmPartsIssue } = require("./src/inventory/confirmPartsIssue");
const { confirmPartsReturn } = require("./src/inventory/confirmPartsReturn");
const { processExcelImport } = require("./src/inventory/processExcelImport");
const { reverseImport } = require("./src/inventory/reverseImport");
const { autoUpdateWoPartsOnClose } = require("./src/inventory/autoUpdateWoPartsOnClose");
const { sendPoEmails } = require("./src/inventory/sendPoEmails");
const { createContractorJob } = require("./src/contractors/createContractorJob");
const { sendJobInvitation } = require("./src/contractors/sendJobInvitation");
const { updateDocumentValidityStatus } = require("./src/contractors/updateDocumentValidityStatus");
const { recalculateContractorMetrics, recalculateContractorMetricsOnProjectsEdit, recalculateContractorMetricsOnCreate } = require("./src/contractors/recalculateContractorMetrics");
const { updateMachineHistoryOnJobClose } = require("./src/contractors/updateMachineHistoryOnJobClose");
const { generateContractorReport } = require("./src/contractors/generateContractorReport");
const { notifyInvoiceVariance } = require("./src/contractors/notifyInvoiceVariance");

exports.processPartsRequest = processPartsRequest;
exports.notifyLowStock = notifyLowStock;
exports.notifyLowStockOnCreate = notifyLowStockOnCreate;
exports.reserveStock = reserveStock;
exports.confirmPartsIssue = confirmPartsIssue;
exports.confirmPartsReturn = confirmPartsReturn;
exports.processExcelImport = processExcelImport;
exports.reverseImport = reverseImport;
exports.autoUpdateWoPartsOnClose = autoUpdateWoPartsOnClose;
exports.sendPoEmails = sendPoEmails;
exports.createContractorJob = createContractorJob;
exports.sendJobInvitation = sendJobInvitation;
exports.updateDocumentValidityStatus = updateDocumentValidityStatus;
exports.recalculateContractorMetrics = recalculateContractorMetrics;
exports.recalculateContractorMetricsOnProjectsEdit = recalculateContractorMetricsOnProjectsEdit;
exports.recalculateContractorMetricsOnCreate = recalculateContractorMetricsOnCreate;
exports.updateMachineHistoryOnJobClose = updateMachineHistoryOnJobClose;
exports.generateContractorReport = generateContractorReport;
exports.notifyInvoiceVariance = notifyInvoiceVariance;

// ---------------------------------------------------------------------------
// PM Module — Cloud Functions
// ---------------------------------------------------------------------------

const { schedulePmCheck, onPmMeterUpdated } = require("./src/pm/schedulePmCheck");
const { syncPmScheduleWoStatus } = require("./src/pm/pmCompliance");
const { checkPmOverdue } = require("./src/pm/checkPmOverdue");
const { expireTrials } = require("./src/billing/expireTrials");
const { updatePmComplianceOnWoClose } = require("./src/pm/updatePmComplianceOnWoClose");
const { triggerManualPM } = require("./src/pm/triggerManualPM");

exports.schedulePmCheck = schedulePmCheck;
exports.onPmMeterUpdated = onPmMeterUpdated;
exports.syncPmScheduleWoStatus = syncPmScheduleWoStatus;
exports.checkPmOverdue = checkPmOverdue;
exports.expireTrials = expireTrials;
exports.updatePmComplianceOnWoClose = updatePmComplianceOnWoClose;
exports.triggerManualPM = triggerManualPM;

// ---------------------------------------------------------------------------
// Machines — keep registry status in sync with breakdowns / work orders
// ---------------------------------------------------------------------------

const {
  markMachineDownOnBreakdownReported,
  reactivateMachineOnBreakdownClose,
  reactivateMachineOnWOSignOff,
} = require("./src/machines/syncMachineStatus");

exports.markMachineDownOnBreakdownReported = markMachineDownOnBreakdownReported;
exports.reactivateMachineOnBreakdownClose = reactivateMachineOnBreakdownClose;
exports.reactivateMachineOnWOSignOff = reactivateMachineOnWOSignOff;

// Plant stamps on every machine-linked record (replacing the create-only
// stampWorkOrderPlant / stampBreakdownPlant), open work following a machine
// moved to another plant, and a one-time backfill of existing records.
const {
  stampPlantOnWorkOrder,
  stampPlantOnBreakdown,
  stampPlantOnPmSchedule,
  stampPlantOnPmHistory,
  propagateMachinePlant,
  backfillPlantStamps,
} = require("./src/machines/plantStamps");

exports.stampPlantOnWorkOrder = stampPlantOnWorkOrder;
exports.stampPlantOnBreakdown = stampPlantOnBreakdown;
exports.stampPlantOnPmSchedule = stampPlantOnPmSchedule;
exports.stampPlantOnPmHistory = stampPlantOnPmHistory;
exports.propagateMachinePlant = propagateMachinePlant;
exports.backfillPlantStamps = backfillPlantStamps;

const {syncMachineNextPm, syncMachineLastService} = require("./src/machines/syncMachineServiceDates");

exports.syncMachineNextPm = syncMachineNextPm;
exports.syncMachineLastService = syncMachineLastService;

const {getPublicMachine} = require("./src/machines/publicMachine");

exports.getPublicMachine = getPublicMachine;

// Company-wide plan-limit counts (plant-scoped roles can't count other plants' records).
const {getPlanUsage} = require("./src/billing/planUsage");

exports.getPlanUsage = getPlanUsage;

const {costWorkOrder} = require("./src/workorders/costWorkOrder");

exports.costWorkOrder = costWorkOrder;

// ---------------------------------------------------------------------------
// Training Module — Cloud Functions
// ---------------------------------------------------------------------------

const { autoCompileShiftSummary } = require("./src/handover/autoCompileShiftSummary");
const { submitHandover } = require("./src/handover/submitHandover");
const { acceptHandover } = require("./src/handover/acceptHandover");
const { checkUnacceptedHandovers } = require("./src/handover/checkUnacceptedHandovers");
const { carryForwardWatchFlags } = require("./src/handover/carryForwardWatchFlags");
const {
  resolveWatchFlagOnTicketClose,
  resolveWatchFlagOnBreakdownClose,
} = require("./src/handover/resolveWatchFlagOnTicketClose");
const {
  onShiftPlanUpdated,
  onHandoverSubmitted,
  sendShiftStartReminders,
} = require("./src/handover/shiftEmails");

exports.autoCompileShiftSummary = autoCompileShiftSummary;
exports.submitHandover = submitHandover;
exports.acceptHandover = acceptHandover;
exports.checkUnacceptedHandovers = checkUnacceptedHandovers;
exports.carryForwardWatchFlags = carryForwardWatchFlags;
exports.resolveWatchFlagOnTicketClose = resolveWatchFlagOnTicketClose;
exports.resolveWatchFlagOnBreakdownClose = resolveWatchFlagOnBreakdownClose;
exports.onShiftPlanUpdated = onShiftPlanUpdated;
exports.onHandoverSubmitted = onHandoverSubmitted;
exports.sendShiftStartReminders = sendShiftStartReminders;

const { generateTrainingCertificate } = require("./src/training/generateTrainingCertificate");
const { checkRetrainingTrigger } = require("./src/training/checkRetrainingTrigger");
const { sendTrainingReminders } = require("./src/training/sendTrainingReminders");
const { notifyPracticalSignOffRequired } = require("./src/training/notifyPracticalSignOffRequired");
const { onOffboardTrainingAssigned } = require("./src/training/onOffboardTrainingAssigned");
const { onOffboardTrainingCompleted } = require("./src/training/onOffboardTrainingCompleted");
const { checkOverdueOffboardReports } = require("./src/training/checkOverdueOffboardReports");
const { submitTrainingQuiz, completeTrainingAssignment } = require("./src/training/trainingProgress");

exports.generateTrainingCertificate = generateTrainingCertificate;
exports.checkRetrainingTrigger = checkRetrainingTrigger;
exports.sendTrainingReminders = sendTrainingReminders;
exports.notifyPracticalSignOffRequired = notifyPracticalSignOffRequired;
exports.onOffboardTrainingAssigned = onOffboardTrainingAssigned;
exports.onOffboardTrainingCompleted = onOffboardTrainingCompleted;
exports.checkOverdueOffboardReports = checkOverdueOffboardReports;
exports.submitTrainingQuiz = submitTrainingQuiz;
exports.completeTrainingAssignment = completeTrainingAssignment;

// ---------------------------------------------------------------------------
// Reports Module — Cloud Functions
// ---------------------------------------------------------------------------

const { generateReport } = require("./src/reports/generateReport");
const { cleanupOldReports } = require("./src/reports/cleanupOldReports");
const { generateScheduledReport } = require("./src/reports/generateScheduledReport");

exports.generateReport = generateReport;
exports.cleanupOldReports = cleanupOldReports;
exports.generateScheduledReport = generateScheduledReport;

// ---------------------------------------------------------------------------
// Analytics Module — Cloud Functions
// ---------------------------------------------------------------------------

// generateDailyAnalytics, recalculateMtbf and recalculateMttr are retired:
// they wrote analytics_daily / machine_health figures with their own
// definitions (UTC days, MTTR from repair start, MTBF between closures) that
// contradicted the dashboards, and nothing reads analytics_daily any more.
// Machine MTBF / MTTR / health now come from src/machines/machineHealth.js.
const { generateMonthlyAnalytics } = require("./src/analytics/generateMonthlyAnalytics");
const {
  updateMachineHealth,
  machineHealthOnPmHistoryWrite,
  machineHealthOnWorkOrderWrite,
  machineHealthOnMachineWrite,
  recomputeMachineHealthDaily,
} = require("./src/machines/machineHealth");
const { updateTechnicianStatus } = require("./src/analytics/updateTechnicianStatus");
const { metricsDaily } = require("./src/analytics/metricsDaily");

exports.generateMonthlyAnalytics = generateMonthlyAnalytics;
exports.updateMachineHealth = updateMachineHealth;
exports.machineHealthOnPmHistoryWrite = machineHealthOnPmHistoryWrite;
exports.machineHealthOnWorkOrderWrite = machineHealthOnWorkOrderWrite;
exports.machineHealthOnMachineWrite = machineHealthOnMachineWrite;
exports.recomputeMachineHealthDaily = recomputeMachineHealthDaily;
exports.updateTechnicianStatus = updateTechnicianStatus;
exports.metricsDaily = metricsDaily;

// ---------------------------------------------------------------------------
// MOE Module (Machine Overall Effectiveness) — Cloud Functions
// Replaces the retired OEE module: real production-count/IoT data was never
// captured by this factory, so MOE is a composite score computed entirely
// from data already in the system (breakdowns, PM history, machine health,
// criticality). See src/modules/moe/services/moe.service.ts for the client
// mirror of this math.
// ---------------------------------------------------------------------------

const { calculateDailyMoeSnapshots } = require("./src/moe/calculateDailyMoeSnapshots");
const {
  moeOnBreakdownWrite,
  moeOnPmHistoryWrite,
  moeOnWorkOrderWrite,
  processMoeRecalcQueue,
} = require("./src/moe/recalculateMoeOnDataChange");
const { getMoeAggregates } = require("./src/moe/getMoeAggregates");
const { backfillMoeSnapshots } = require("./src/moe/backfillMoeSnapshots");

exports.calculateDailyMoeSnapshots = calculateDailyMoeSnapshots;
// Replace the old recalculateMoeOn*Change triggers, which listened on the
// wrong database and never fired (deleted on deploy via --force).
exports.moeOnBreakdownWrite = moeOnBreakdownWrite;
exports.moeOnPmHistoryWrite = moeOnPmHistoryWrite;
exports.moeOnWorkOrderWrite = moeOnWorkOrderWrite;
exports.processMoeRecalcQueue = processMoeRecalcQueue;
exports.getMoeAggregates = getMoeAggregates;
exports.backfillMoeSnapshots = backfillMoeSnapshots;

// ---------------------------------------------------------------------------
// Invitations Module — Cloud Functions
// ---------------------------------------------------------------------------

const { sendInvitationEmail } = require("./src/invitations/sendInvitationEmail");

exports.sendInvitationEmail = sendInvitationEmail;

// ---------------------------------------------------------------------------
// Contractor safety training — token-link training for contractor team
// members (no login). Company users keep the in-app safety training flow.
// ---------------------------------------------------------------------------

const {
  sendContractorSafetyTrainingInvites,
  getContractorSafetyTrainingForm,
  submitContractorSafetyTraining,
} = require("./src/safetyTraining/contractorSafetyTraining");

exports.sendContractorSafetyTrainingInvites = sendContractorSafetyTrainingInvites;
exports.getContractorSafetyTrainingForm = getContractorSafetyTrainingForm;
exports.submitContractorSafetyTraining = submitContractorSafetyTraining;

// ---------------------------------------------------------------------------
// Staff Requests — recipient directory for roles that can't read the roster
// ---------------------------------------------------------------------------

const { listRequestRecipients } = require("./src/requests/listRequestRecipients");
const { purgeExpiredRecordGrants } = require("./src/requests/purgeExpiredRecordGrants");
const { listRecordReferences } = require("./src/requests/listRecordReferences");

exports.listRequestRecipients = listRequestRecipients;
exports.purgeExpiredRecordGrants = purgeExpiredRecordGrants;
exports.listRecordReferences = listRecordReferences;

// ---------------------------------------------------------------------------
// Billing Module — Stripe Cloud Functions
// ---------------------------------------------------------------------------

const { createCheckoutSession } = require("./src/billing/createCheckoutSession");
const { createPortalSession } = require("./src/billing/createPortalSession");
const { stripeWebhook } = require("./src/billing/stripeWebhook");
const { requestCancellation } = require("./src/billing/cancellations");
const {
  createCardSetup,
  finalizeCardSetup,
  getBillingOverview,
  updatePaymentMethod,
} = require("./src/billing/billingAccount");

exports.createCheckoutSession = createCheckoutSession;
exports.createPortalSession = createPortalSession;
exports.requestCancellation = requestCancellation;
exports.stripeWebhook = stripeWebhook;
exports.createCardSetup = createCardSetup;
exports.finalizeCardSetup = finalizeCardSetup;
exports.getBillingOverview = getBillingOverview;
exports.updatePaymentMethod = updatePaymentMethod;

// ---------------------------------------------------------------------------
// AI — Claude proxy (keeps ANTHROPIC_API_KEY server-side)
// ---------------------------------------------------------------------------

const { claudeJson } = require("./src/ai/claudeJson");

exports.claudeJson = claudeJson;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate next WO number via atomic Firestore transaction.
 * Format: WO-2025-0047
 */
async function generateWONumber(siteId, year) {
  const counterRef = db.collection("woCounters").doc(`${siteId}_${year}`);
  let sequence = 1;

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    if (doc.exists) {
      sequence = doc.data().lastSequence + 1;
      tx.update(counterRef, { lastSequence: sequence });
    } else {
      tx.set(counterRef, { siteId, year, lastSequence: 1 });
    }
  });

  return `WO-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Send FCM push notification to a list of user IDs.
 * Looks up fcmToken for each user from the users collection.
 */
async function sendPushToUsers(userIds, title, body, data = {}) {
  if (!userIds.length) return;

  const tokens = [];
  for (const uid of userIds) {
    try {
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data();
      const token = userData && userData.fcmToken;
      if (token) tokens.push(token);
    } catch (err) {
      logger.warn(`FCM token lookup failed for user ${uid}`, err);
    }
  }

  if (!tokens.length) return;

  try {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...data },
    });
  } catch (err) {
    logger.error("FCM multicast failed", err);
  }
}

/**
 * Calculate SLA deadline from priority and creation time.
 */
function calcSlaDeadline(createdAt, priority) {
  const slaHoursMap = { critical: 2, high: 8, medium: 24, low: 72 };
  const hours = slaHoursMap[priority] ?? 24;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Recalculate machine health score.
 * baseScore = 100 - (breakdowns last 30d × 10) - (overdue PMs × 5) + (PM compliance last 90d × 20)
 */
async function recalculateMachineHealth(machineId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Count recent breakdowns
  const breakdownsSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "BREAKDOWN")
    .where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo))
    .get();
  const recentBreakdowns = breakdownsSnap.size;

  // Count overdue PMs (open PREVENTIVE WOs past SLA)
  const overdueSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "PREVENTIVE")
    .where("slaBreached", "==", true)
    .where("status", "not-in", [
      "COMPLETED",
      "SIGNED_OFF",
      "CLOSED",
      "CANCELLED",
    ])
    .get();
  const overduePMs = overdueSnap.size;

  // PM compliance: completed PREVENTIVE WOs in last 90d vs scheduled
  const completedPMSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "PREVENTIVE")
    .where("status", "in", ["COMPLETED", "SIGNED_OFF", "CLOSED"])
    .where("createdAt", ">=", Timestamp.fromDate(ninetyDaysAgo))
    .get();
  const allPMSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "PREVENTIVE")
    .where("createdAt", ">=", Timestamp.fromDate(ninetyDaysAgo))
    .get();

  const pmComplianceRate =
    allPMSnap.size > 0 ? completedPMSnap.size / allPMSnap.size : 1;

  let score =
    100 - recentBreakdowns * 10 - overduePMs * 5 + pmComplianceRate * 20;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let healthStatus = "green";
  if (score < 50) healthStatus = "red";
  else if (score < 80) healthStatus = "yellow";

  return { score, healthStatus };
}

// ---------------------------------------------------------------------------
// 1. onWOCreated
// ---------------------------------------------------------------------------

exports.onWOCreated = onDocumentCreated({ database: "default", document: "workOrders/{woId}" }, async (event) => {
  const snap = event.data;
  const woId = event.params.woId;
  const wo = snap.data();
  const now = new Date();
  const year = now.getFullYear();

  try {
    // A number issued by a server function (PM generation) together with the
    // work order is kept; every other work order gets the next number here.
    const woNumber = wo.woNumberIssuedBy === "server" && wo.woNumber ?
      wo.woNumber :
      await generateWONumber(wo.siteId, year);

    // SLA: a preventive work order is due on its due date (it may be raised
    // days ahead under the schedule's lead time); everything else is timed
    // from creation by priority.
    const due = wo.dueDate && typeof wo.dueDate.toDate === "function" ? wo.dueDate.toDate() : null;
    const slaDeadline = wo.woType === "PREVENTIVE" && due ?
      new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) + 24 * 60 * 60 * 1000 - 1) :
      calcSlaDeadline(now, wo.priority);

    const updates = {
      woNumber,
      slaDeadline: Timestamp.fromDate(slaDeadline),
      slaBreached: false,
    };
    // Analytics read work orders by companyId; some creators only set siteId
    // (siteId is the company id in the single-site-per-company model).
    if (!wo.companyId && wo.siteId) {
      const company = await db.collection("companies").doc(String(wo.siteId)).get();
      if (company.exists) updates.companyId = wo.siteId;
    }

    await snap.ref.update(updates);

    // FCM push to assigned technicians
    if (wo.assignedTechnicianIds?.length) {
      await sendPushToUsers(
        wo.assignedTechnicianIds,
        "New Work Order Assigned",
        `${woNumber} — ${wo.machineName}`,
        { woId, woNumber, screen: "WODetail" },
      );
    }

    // Link the breakdown ticket(s) back to the work order (the legacy
    // `breakdowns` collection this used to update no longer exists, so the
    // update threw and skipped the rest of this function).
    const ticketIds = [...new Set([wo.linkedBreakdownId, ...(wo.linkedBreakdownIds || [])].filter(Boolean))];
    for (const ticketId of ticketIds) {
      const ticketRef = db.collection("breakdown_tickets").doc(String(ticketId));
      const ticket = await ticketRef.get();
      const t = ticket.exists ? ticket.data() : null;
      if (t && (t.companyId || t.siteId) === (updates.companyId || wo.companyId || wo.siteId)) {
        await ticketRef.update({linkedWOId: woId, linkedWONumber: woNumber});
      }
    }

    // Contractor invitation (email + WhatsApp — stub; real impl via SendGrid/WhatsApp API)
    if (wo.woType === "CONTRACTOR" && wo.contractorContactNumber) {
      logger.info(`Contractor invitation triggered for WO ${woNumber}`, {
        contractor: wo.contractorCompanyName,
        contact: wo.contractorContactPerson,
      });
      // TODO: integrate with WhatsApp Business API / SendGrid
    }

    logger.info(`WO created: ${woNumber} (${woId})`);
  } catch (err) {
    logger.error(`onWOCreated failed for ${woId}`, err);
  }
});

// ---------------------------------------------------------------------------
// 2. onWOUpdated
// ---------------------------------------------------------------------------

exports.onWOUpdated = onDocumentUpdated({ database: "default", document: "workOrders/{woId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const woId = event.params.woId;

  try {
    // Newly assigned technicians
    const prevIds = new Set(before.assignedTechnicianIds ?? []);
    const newIds = (after.assignedTechnicianIds ?? []).filter(
      (id) => !prevIds.has(id),
    );
    if (newIds.length) {
      await sendPushToUsers(
        newIds,
        "Work Order Assigned to You",
        `${after.woNumber} — ${after.machineName}`,
        { woId, woNumber: after.woNumber, screen: "WODetail" },
      );
    }

    // Status change handling
    if (before.status !== after.status) {
      const status = after.status;

      // Finished after its SLA deadline (between two slaBreachCheck runs, or
      // after the warning window) → record the breach so SLA compliance
      // counts it.
      const DONE = ["COMPLETED", "SIGNED_OFF", "CLOSED"];
      if (DONE.includes(status) && !DONE.includes(before.status) && after.slaBreached !== true &&
        after.slaDeadline && typeof after.slaDeadline.toMillis === "function") {
        const doneAt = after.actualEndTime && typeof after.actualEndTime.toMillis === "function" ?
          after.actualEndTime.toMillis() :
          Date.now();
        if (doneAt > after.slaDeadline.toMillis()) {
          await event.data.after.ref.update({ slaBreached: true, slaBreachedAt: Timestamp.fromMillis(after.slaDeadline.toMillis()) });
        }
      }

      if (status === "ON_HOLD_PARTS") {
        // Notify Store Keeper + Supervisor
        const storeKeepersSnap = await db
          .collection("users")
          .where("siteId", "==", after.siteId)
          .where("role", "==", "store_keeper")
          .get();
        const storeKeeperIds = storeKeepersSnap.docs.map((d) => d.id);

        await sendPushToUsers(
          [...storeKeeperIds, after.supervisorInChargeId],
          "WO On Hold — Parts Required",
          `${after.woNumber}: parts unavailable`,
          { woId, screen: "WODetail" },
        );
      }

      if (status === "ON_HOLD_APPROVAL") {
        const managersSnap = await db
          .collection("users")
          .where("siteId", "==", after.siteId)
          .where("role", "==", "plant_manager")
          .get();
        const managerIds = managersSnap.docs.map((d) => d.id);

        await sendPushToUsers(
          [...managerIds, after.supervisorInChargeId],
          "WO On Hold — Approval Needed",
          `${after.woNumber} requires manager approval`,
          { woId, screen: "WODetail" },
        );
      }

      if (status === "COMPLETED") {
        await sendPushToUsers(
          [after.supervisorInChargeId],
          "WO Completed — Sign-Off Required",
          `${after.woNumber} awaits your sign-off`,
          { woId, screen: "SignOff" },
        );
      }

      if (status === "SIGNED_OFF") {
        // Trigger machine history update
        await exports.onWOSignedOff(woId, after);
      }
    }
  } catch (err) {
    logger.error(`onWOUpdated failed for ${woId}`, err);
  }
});

// ---------------------------------------------------------------------------
// 3. onWOSignedOff — called from onWOUpdated
// ---------------------------------------------------------------------------

exports.onWOSignedOff = async (woId, wo) => {
  try {
    const machineRef = db.collection("machines").doc(wo.machineId);
    const machineDoc = await machineRef.get();

    if (!machineDoc.exists) {
      logger.warn(
        `Machine ${wo.machineId} not found during sign-off of WO ${woId}`,
      );
      return;
    }

    const { score: machineHealthScore, healthStatus } =
      await recalculateMachineHealth(wo.machineId);

    const machineUpdates = {
      lastServiceDate: Timestamp.now(),
      lastServiceType: wo.woType,
      lastTechnicianIds: wo.assignedTechnicianIds ?? [],
      lastTechnicianNames: wo.assignedTechnicianNames ?? [],
      machineHealthScore,
      healthStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Append parts replaced
    if (wo.partsUsed?.length) {
      machineUpdates.partsReplaced = FieldValue.arrayUnion(
        ...wo.partsUsed.map((p) => ({
          partName: p.partName,
          replacedAt: Timestamp.now(),
          quantity: p.quantity,
          warrantyMonths: p.warrantyMonths ?? null,
        })),
      );
    }

    // Append warranty items
    const warrantyParts = (wo.partsUsed ?? []).filter((p) => p.warrantyMonths);
    if (warrantyParts.length) {
      machineUpdates.warrantyItems = FieldValue.arrayUnion(
        ...warrantyParts.map((p) => ({
          partName: p.partName,
          warrantyMonths: p.warrantyMonths,
          installedAt: Timestamp.now(),
        })),
      );
    }

    // Modification notes
    if (wo.woType === "MODIFICATION" && wo.workDoneDescription) {
      machineUpdates.modificationNotes = FieldValue.arrayUnion({
        description: wo.workDoneDescription,
        date: Timestamp.now(),
        woNumber: wo.woNumber,
      });
    }

    // Decrement open WO count
    machineUpdates.openWOCount = FieldValue.increment(-1);

    await machineRef.update(machineUpdates);

    // Write machine history entry
    const totalPartsCost = (wo.partsUsed ?? []).reduce(
      (sum, p) => sum + (p.totalCost ?? 0),
      0,
    );
    await db
      .collection("machineHistory")
      .doc(wo.machineId)
      .collection("entries")
      .add({
        woNumber: wo.woNumber,
        woType: wo.woType,
        priority: wo.priority,
        date: Timestamp.now(),
        actualStartTime: wo.actualStartTime,
        actualEndTime: wo.actualEndTime,
        totalDurationMinutes: wo.totalDurationMinutes,
        rootCause: wo.rootCause ?? null,
        workDoneDescription: wo.workDoneDescription ?? "",
        internalTeamNames: wo.assignedTechnicianNames ?? [],
        contractorName: wo.contractorCompanyName ?? null,
        contractorTechnicianNames: wo.contractorTechnicianNames ?? [],
        partsUsed: wo.partsUsed ?? [],
        totalPartsCost,
        testRunResult: wo.testRunResult ?? "",
        finalPhotoUrls: wo.finalPhotos ?? [],
        supervisorSignOffBy: wo.supervisorSignOffBy ?? "",
        supervisorSignOffAt: wo.supervisorSignOffAt,
        linkedBreakdownId: wo.linkedBreakdownId ?? null,
      });

    // Deduct parts from inventory
    if (wo.partsUsed?.length) {
      for (const part of wo.partsUsed) {
        if (part.partId && part.source === "stock") {
          await db
            .collection("parts")
            .doc(part.partId)
            .update({
              stockQuantity: FieldValue.increment(-part.quantity),
              updatedAt: FieldValue.serverTimestamp(),
            });
        }
      }
    }

    // Close the WO
    await db.collection("workOrders").doc(woId).update({
      status: "CLOSED",
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notify Plant Manager
    const managersSnap = await db
      .collection("users")
      .where("siteId", "==", wo.siteId)
      .where("role", "==", "plant_manager")
      .get();
    const managerIds = managersSnap.docs.map((d) => d.id);

    await sendPushToUsers(
      managerIds,
      "Work Order Closed",
      `${wo.woNumber} signed off and closed. Machine health: ${machineHealthScore}%`,
      { woId, screen: "WODetail" },
    );

    logger.info(`WO signed off and closed: ${wo.woNumber}`);
  } catch (err) {
    logger.error(`onWOSignedOff failed for WO ${woId}`, err);
  }
};

// ---------------------------------------------------------------------------
// 4. onPartsRequestCreated
// ---------------------------------------------------------------------------

exports.onPartsRequestCreated = onDocumentCreated({ database: "default", document: "workOrders/{woId}/partsRequests/{requestId}" },
  async (event) => {
    const requestId = event.params.requestId;
    const woId = event.params.woId;
    const request = event.data.data();

    try {
      const woDoc = await db.collection("workOrders").doc(woId).get();
      const wo = woDoc.data();

      if (!wo) return;

      const storeKeepersSnap = await db
        .collection("users")
        .where("siteId", "==", wo.siteId)
        .where("role", "==", "store_keeper")
        .get();
      const storeKeeperIds = storeKeepersSnap.docs.map((d) => d.id);

      await sendPushToUsers(
        storeKeeperIds,
        "Parts Request Pending",
        `${wo.woNumber}: ${request.partName} × ${request.quantity}`,
        { woId, requestId, screen: "PartsRequest" },
      );

      // If part is critical, also notify Supervisor
      if (request.partId) {
        const partDoc = await db.collection("parts").doc(request.partId).get();
        if (partDoc.data()?.isCritical) {
          await sendPushToUsers(
            [wo.supervisorInChargeId],
            "Critical Part Requested",
            `${wo.woNumber}: ${request.partName}`,
            { woId, screen: "WODetail" },
          );
        }
      }

      logger.info(`Parts request created for WO ${woId}: ${requestId}`);
    } catch (err) {
      logger.error(
        `onPartsRequestCreated failed for ${woId}/${requestId}`,
        err,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// 5. slaBreachCheck — runs every 5 minutes
// ---------------------------------------------------------------------------

const OPEN_WO_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_APPROVAL"];

/** Active plant managers of the work order's company and plant (plus any with no plant). */
async function plantManagerIdsFor(wo) {
  const companyId = wo.companyId || wo.siteId;
  const snap = await db.collection("users").where("companyId", "==", companyId).where("role", "==", "plant_manager").get();
  const plantId = wo.machinePlantId || null;
  return snap.docs
    .filter((d) => d.data().status !== "inactive")
    .filter((d) => !plantId || !d.data().plantId || d.data().plantId === plantId)
    .map((d) => d.id);
}

// Open work orders only (status filter): finished work orders used to stay
// in this query forever and were re-read every 5 minutes. The warning is
// sent once per work order (slaWarningSentAt), not on every run in the
// 30-minute window. A work order finished after its deadline is marked
// breached by onWOUpdated.
exports.slaBreachCheck = onSchedule({ schedule: "every 5 minutes", timeoutSeconds: 240 }, async () => {
  const now = Timestamp.now();
  const warningThreshold = new Date(Date.now() + 30 * 60 * 1000);

  try {
    const approachingSnap = await db
      .collection("workOrders")
      .where("status", "in", OPEN_WO_STATUSES)
      .where("slaBreached", "==", false)
      .where("slaDeadline", "<=", Timestamp.fromDate(warningThreshold))
      .get();

    for (const doc of approachingSnap.docs) {
      const wo = doc.data();
      try {
        const slaDeadlineMs = wo.slaDeadline.toMillis();
        const isBreached = slaDeadlineMs <= now.toMillis();
        if (!isBreached && wo.slaWarningSentAt) continue;

        const recipients = [...new Set([...(await plantManagerIdsFor(wo)), wo.supervisorInChargeId].filter(Boolean))];
        if (isBreached) {
          await doc.ref.update({ slaBreached: true, slaBreachedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
          await sendPushToUsers(recipients, "SLA Breached", `${wo.woNumber} — ${wo.machineName} SLA has been breached`, { woId: doc.id, screen: "WODetail" });
        } else {
          await doc.ref.update({ slaWarningSentAt: FieldValue.serverTimestamp() });
          const minutesLeft = Math.round((slaDeadlineMs - now.toMillis()) / 60000);
          await sendPushToUsers(recipients, "SLA Warning", `${wo.woNumber} — SLA in ${minutesLeft} min`, { woId: doc.id, screen: "WODetail" });
        }
      } catch (err) {
        logger.error(`slaBreachCheck failed for ${doc.id}`, err);
      }
    }

    logger.info(`slaBreachCheck completed (${approachingSnap.size} checked)`);
  } catch (err) {
    logger.error("slaBreachCheck failed", err);
  }
});

// ---------------------------------------------------------------------------
// 6. generateContractorInvitation — callable function
// ---------------------------------------------------------------------------

exports.generateContractorInvitation = onCall(async (request) => {
  const { woId, contractorId } = request.data;

  if (!request.auth)
    throw new HttpsError("unauthenticated", "Must be authenticated");

  try {
    const woDoc = await db.collection("workOrders").doc(woId).get();
    if (!woDoc.exists)
      throw new HttpsError("not-found", "Work order not found");

    const wo = woDoc.data();
    // Only a manager of the work order's own company may build its invitation.
    await requireMember(request, wo.companyId || wo.siteId, {roles: ["admin", "plant_manager", "supervisor", "maintenance_supervisor", "hr_officer"]});
    let contractor = null;

    if (contractorId) {
      const contractorDoc = await db
        .collection("contractors")
        .doc(contractorId)
        .get();
      if (contractorDoc.exists) contractor = contractorDoc.data();
    }

    const contactName =
      contractor?.primaryContactName ??
      wo.contractorContactPerson ??
      "Sir/Madam";
    const contactPhone =
      contractor?.primaryContactPhone ?? wo.contractorContactNumber;
    const companyName = contractor?.companyName ?? wo.contractorCompanyName;

    // Build invitation payload (email/WhatsApp sent via external API)
    const invitation = {
      to: contactPhone,
      companyName,
      contactName,
      woNumber: wo.woNumber,
      machineName: wo.machineName,
      machineLocation: wo.machineLocation,
      description: wo.description,
      priority: wo.priority,
      slaDeadline: wo.slaDeadline?.toDate()?.toISOString(),
      siteContact: wo.supervisorInChargeName,
    };

    logger.info("Contractor invitation payload prepared", invitation);

    // Log invitation on WO
    await woDoc.ref.update({
      contractorInvitationSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // TODO: send via WhatsApp Business API and/or SendGrid
    return { success: true, invitation };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("generateContractorInvitation failed", err);
    throw new HttpsError(
      "internal",
      "Failed to generate contractor invitation",
    );
  }
});

// Platform console (Lumora Ventures superadmins): companies, subscriptions,
// payments, reminders, login support, and company feedback / requests.
const {platformClaimSuperadmin} = require("./src/platform/platformAdmins");
const {platformDeleteCompany} = require("./src/platform/deleteCompany");
const {
  platformOverview, platformListCompanies, platformGetCompany, platformUpdateCompany, platformManageUser, platformAuditLog,
} = require("./src/platform/platformCompanies");
const {
  platformListPayments, platformDailyBillingDigest,
} = require("./src/platform/platformPayments");
const {platformTranscribeCall} = require("./src/platform/callRecordings");
exports.platformTranscribeCall = platformTranscribeCall;
const {onSupportRequestCreated, onSupportMessageCreated, onSupportRequestStatusChanged} = require("./src/platform/supportRequests");
const {onCompanyRegistered} = require("./src/platform/companyApprovals");
const {onUserMappingWritten, syncCompanyClaim} = require("./src/auth/companyClaim");
const {onCompanyUserWritten, enforceInactiveUsers} = require("./src/auth/userAccess");

exports.platformClaimSuperadmin = platformClaimSuperadmin;
exports.platformOverview = platformOverview;
exports.platformListCompanies = platformListCompanies;
exports.platformGetCompany = platformGetCompany;
exports.platformUpdateCompany = platformUpdateCompany;
exports.platformDeleteCompany = platformDeleteCompany;
exports.platformManageUser = platformManageUser;
exports.platformAuditLog = platformAuditLog;
exports.platformListPayments = platformListPayments;
exports.platformDailyBillingDigest = platformDailyBillingDigest;
exports.onCompanyRegistered = onCompanyRegistered;
exports.onUserMappingWritten = onUserMappingWritten;
exports.syncCompanyClaim = syncCompanyClaim;
exports.onCompanyUserWritten = onCompanyUserWritten;
exports.enforceInactiveUsers = enforceInactiveUsers;
exports.onSupportRequestCreated = onSupportRequestCreated;
exports.onSupportMessageCreated = onSupportMessageCreated;
exports.onSupportRequestStatusChanged = onSupportRequestStatusChanged;
