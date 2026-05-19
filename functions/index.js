const { setGlobalOptions } = require('firebase-functions');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { initializeApp } = require('firebase-admin/app');
const logger = require('firebase-functions/logger');

initializeApp();
setGlobalOptions({ maxInstances: 10 });

const db = getFirestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate next WO number via atomic Firestore transaction.
 * Format: WO-2025-0047
 */
async function generateWONumber(siteId, year) {
  const counterRef = db.collection('woCounters').doc(`${siteId}_${year}`);
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

  return `WO-${year}-${String(sequence).padStart(4, '0')}`;
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
      const userDoc = await db.collection('users').doc(uid).get();
      const token = userDoc.data()?.fcmToken;
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
    logger.error('FCM multicast failed', err);
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
  const breakdownsSnap = await db.collection('workOrders')
    .where('machineId', '==', machineId)
    .where('woType', '==', 'BREAKDOWN')
    .where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
    .get();
  const recentBreakdowns = breakdownsSnap.size;

  // Count overdue PMs (open PREVENTIVE WOs past SLA)
  const overdueSnap = await db.collection('workOrders')
    .where('machineId', '==', machineId)
    .where('woType', '==', 'PREVENTIVE')
    .where('slaBreached', '==', true)
    .where('status', 'not-in', ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'])
    .get();
  const overduePMs = overdueSnap.size;

  // PM compliance: completed PREVENTIVE WOs in last 90d vs scheduled
  const completedPMSnap = await db.collection('workOrders')
    .where('machineId', '==', machineId)
    .where('woType', '==', 'PREVENTIVE')
    .where('status', 'in', ['COMPLETED', 'SIGNED_OFF', 'CLOSED'])
    .where('createdAt', '>=', Timestamp.fromDate(ninetyDaysAgo))
    .get();
  const allPMSnap = await db.collection('workOrders')
    .where('machineId', '==', machineId)
    .where('woType', '==', 'PREVENTIVE')
    .where('createdAt', '>=', Timestamp.fromDate(ninetyDaysAgo))
    .get();

  const pmComplianceRate = allPMSnap.size > 0 ? completedPMSnap.size / allPMSnap.size : 1;

  let score = 100
    - (recentBreakdowns * 10)
    - (overduePMs * 5)
    + (pmComplianceRate * 20);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let healthStatus = 'green';
  if (score < 50) healthStatus = 'red';
  else if (score < 80) healthStatus = 'yellow';

  return { score, healthStatus };
}

// ---------------------------------------------------------------------------
// 1. onWOCreated
// ---------------------------------------------------------------------------

exports.onWOCreated = onDocumentCreated('workOrders/{woId}', async (event) => {
  const snap = event.data;
  const woId = event.params.woId;
  const wo = snap.data();
  const now = new Date();
  const year = now.getFullYear();

  try {
    // Generate WO number
    const woNumber = await generateWONumber(wo.siteId, year);

    // Calculate SLA deadline
    const slaDeadline = calcSlaDeadline(now, wo.priority);

    const updates = {
      woNumber,
      slaDeadline: Timestamp.fromDate(slaDeadline),
      slaBreached: false,
    };

    await snap.ref.update(updates);

    // FCM push to assigned technicians
    if (wo.assignedTechnicianIds?.length) {
      await sendPushToUsers(
        wo.assignedTechnicianIds,
        'New Work Order Assigned',
        `${woNumber} — ${wo.machineName}`,
        { woId, woNumber, screen: 'WODetail' },
      );
    }

    // Link back to breakdown document
    if (wo.linkedBreakdownId) {
      await db.collection('breakdowns').doc(wo.linkedBreakdownId).update({
        linkedWOId: woId,
        linkedWONumber: woNumber,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Contractor invitation (email + WhatsApp — stub; real impl via SendGrid/WhatsApp API)
    if (wo.woType === 'CONTRACTOR' && wo.contractorContactNumber) {
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

exports.onWOUpdated = onDocumentUpdated('workOrders/{woId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const woId = event.params.woId;

  try {
    // Newly assigned technicians
    const prevIds = new Set(before.assignedTechnicianIds ?? []);
    const newIds = (after.assignedTechnicianIds ?? []).filter((id) => !prevIds.has(id));
    if (newIds.length) {
      await sendPushToUsers(
        newIds,
        'Work Order Assigned to You',
        `${after.woNumber} — ${after.machineName}`,
        { woId, woNumber: after.woNumber, screen: 'WODetail' },
      );
    }

    // Status change handling
    if (before.status !== after.status) {
      const status = after.status;

      if (status === 'ON_HOLD_PARTS') {
        // Notify Store Keeper + Supervisor
        const storeKeepersSnap = await db.collection('users')
          .where('siteId', '==', after.siteId)
          .where('role', '==', 'store_keeper')
          .get();
        const storeKeeperIds = storeKeepersSnap.docs.map((d) => d.id);

        await sendPushToUsers(
          [...storeKeeperIds, after.supervisorInChargeId],
          'WO On Hold — Parts Required',
          `${after.woNumber}: parts unavailable`,
          { woId, screen: 'WODetail' },
        );
      }

      if (status === 'ON_HOLD_APPROVAL') {
        const managersSnap = await db.collection('users')
          .where('siteId', '==', after.siteId)
          .where('role', '==', 'plant_manager')
          .get();
        const managerIds = managersSnap.docs.map((d) => d.id);

        await sendPushToUsers(
          [...managerIds, after.supervisorInChargeId],
          'WO On Hold — Approval Needed',
          `${after.woNumber} requires manager approval`,
          { woId, screen: 'WODetail' },
        );
      }

      if (status === 'COMPLETED') {
        await sendPushToUsers(
          [after.supervisorInChargeId],
          'WO Completed — Sign-Off Required',
          `${after.woNumber} awaits your sign-off`,
          { woId, screen: 'SignOff' },
        );
      }

      if (status === 'SIGNED_OFF') {
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
    const machineRef = db.collection('machines').doc(wo.machineId);
    const machineDoc = await machineRef.get();

    if (!machineDoc.exists) {
      logger.warn(`Machine ${wo.machineId} not found during sign-off of WO ${woId}`);
      return;
    }

    const { score: machineHealthScore, healthStatus } = await recalculateMachineHealth(wo.machineId);

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
      machineUpdates.partsReplaced = FieldValue.arrayUnion(...wo.partsUsed.map((p) => ({
        partName: p.partName,
        replacedAt: Timestamp.now(),
        quantity: p.quantity,
        warrantyMonths: p.warrantyMonths ?? null,
      })));
    }

    // Append warranty items
    const warrantyParts = (wo.partsUsed ?? []).filter((p) => p.warrantyMonths);
    if (warrantyParts.length) {
      machineUpdates.warrantyItems = FieldValue.arrayUnion(...warrantyParts.map((p) => ({
        partName: p.partName,
        warrantyMonths: p.warrantyMonths,
        installedAt: Timestamp.now(),
      })));
    }

    // Modification notes
    if (wo.woType === 'MODIFICATION' && wo.workDoneDescription) {
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
    const totalPartsCost = (wo.partsUsed ?? []).reduce((sum, p) => sum + (p.totalCost ?? 0), 0);
    await db.collection('machineHistory').doc(wo.machineId)
      .collection('entries')
      .add({
        woNumber: wo.woNumber,
        woType: wo.woType,
        priority: wo.priority,
        date: Timestamp.now(),
        actualStartTime: wo.actualStartTime,
        actualEndTime: wo.actualEndTime,
        totalDurationMinutes: wo.totalDurationMinutes,
        rootCause: wo.rootCause ?? null,
        workDoneDescription: wo.workDoneDescription ?? '',
        internalTeamNames: wo.assignedTechnicianNames ?? [],
        contractorName: wo.contractorCompanyName ?? null,
        contractorTechnicianNames: wo.contractorTechnicianNames ?? [],
        partsUsed: wo.partsUsed ?? [],
        totalPartsCost,
        testRunResult: wo.testRunResult ?? '',
        finalPhotoUrls: wo.finalPhotos ?? [],
        supervisorSignOffBy: wo.supervisorSignOffBy ?? '',
        supervisorSignOffAt: wo.supervisorSignOffAt,
        linkedBreakdownId: wo.linkedBreakdownId ?? null,
      });

    // Deduct parts from inventory
    if (wo.partsUsed?.length) {
      for (const part of wo.partsUsed) {
        if (part.partId && part.source === 'stock') {
          await db.collection('parts').doc(part.partId).update({
            stockQuantity: FieldValue.increment(-part.quantity),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // Close the WO
    await db.collection('workOrders').doc(woId).update({
      status: 'CLOSED',
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notify Plant Manager
    const managersSnap = await db.collection('users')
      .where('siteId', '==', wo.siteId)
      .where('role', '==', 'plant_manager')
      .get();
    const managerIds = managersSnap.docs.map((d) => d.id);

    await sendPushToUsers(
      managerIds,
      'Work Order Closed',
      `${wo.woNumber} signed off and closed. Machine health: ${machineHealthScore}%`,
      { woId, screen: 'WODetail' },
    );

    logger.info(`WO signed off and closed: ${wo.woNumber}`);
  } catch (err) {
    logger.error(`onWOSignedOff failed for WO ${woId}`, err);
  }
};

// ---------------------------------------------------------------------------
// 4. onPartsRequestCreated
// ---------------------------------------------------------------------------

exports.onPartsRequestCreated = onDocumentCreated(
  'workOrders/{woId}/partsRequests/{requestId}',
  async (event) => {
    const requestId = event.params.requestId;
    const woId = event.params.woId;
    const request = event.data.data();

    try {
      const woDoc = await db.collection('workOrders').doc(woId).get();
      const wo = woDoc.data();

      if (!wo) return;

      const storeKeepersSnap = await db.collection('users')
        .where('siteId', '==', wo.siteId)
        .where('role', '==', 'store_keeper')
        .get();
      const storeKeeperIds = storeKeepersSnap.docs.map((d) => d.id);

      await sendPushToUsers(
        storeKeeperIds,
        'Parts Request Pending',
        `${wo.woNumber}: ${request.partName} × ${request.quantity}`,
        { woId, requestId, screen: 'PartsRequest' },
      );

      // If part is critical, also notify Supervisor
      if (request.partId) {
        const partDoc = await db.collection('parts').doc(request.partId).get();
        if (partDoc.data()?.isCritical) {
          await sendPushToUsers(
            [wo.supervisorInChargeId],
            'Critical Part Requested',
            `${wo.woNumber}: ${request.partName}`,
            { woId, screen: 'WODetail' },
          );
        }
      }

      logger.info(`Parts request created for WO ${woId}: ${requestId}`);
    } catch (err) {
      logger.error(`onPartsRequestCreated failed for ${woId}/${requestId}`, err);
    }
  },
);

// ---------------------------------------------------------------------------
// 5. slaBreachCheck — runs every 5 minutes
// ---------------------------------------------------------------------------

exports.slaBreachCheck = onSchedule('every 5 minutes', async () => {
  const now = Timestamp.now();
  const warningMs = 30 * 60 * 1000;
  const warningThreshold = new Date(Date.now() + warningMs);

  try {
    // WOs approaching SLA — warn
    const approachingSnap = await db.collection('workOrders')
      .where('slaBreached', '==', false)
      .where('slaDeadline', '<=', Timestamp.fromDate(warningThreshold))
      .get();

    for (const doc of approachingSnap.docs) {
      const wo = doc.data();
      if (['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(wo.status)) continue;

      const slaDeadlineMs = wo.slaDeadline.toMillis();
      const isBreached = slaDeadlineMs <= now.toMillis();

      const managersSnap = await db.collection('users')
        .where('siteId', '==', wo.siteId)
        .where('role', '==', 'plant_manager')
        .get();
      const managerIds = managersSnap.docs.map((d) => d.id);

      const recipients = [...managerIds, wo.supervisorInChargeId];

      if (isBreached) {
        await sendPushToUsers(
          recipients,
          'SLA Breached',
          `${wo.woNumber} — ${wo.machineName} SLA has been breached`,
          { woId: doc.id, screen: 'WODetail' },
        );
        await doc.ref.update({ slaBreached: true, updatedAt: FieldValue.serverTimestamp() });
      } else {
        const minutesLeft = Math.round((slaDeadlineMs - now.toMillis()) / 60000);
        await sendPushToUsers(
          recipients,
          'SLA Warning',
          `${wo.woNumber} — SLA in ${minutesLeft} min`,
          { woId: doc.id, screen: 'WODetail' },
        );
      }
    }

    logger.info('slaBreachCheck completed');
  } catch (err) {
    logger.error('slaBreachCheck failed', err);
  }
});

// ---------------------------------------------------------------------------
// 6. generateContractorInvitation — callable function
// ---------------------------------------------------------------------------

exports.generateContractorInvitation = onCall(async (request) => {
  const { woId, contractorId } = request.data;

  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  try {
    const woDoc = await db.collection('workOrders').doc(woId).get();
    if (!woDoc.exists) throw new HttpsError('not-found', 'Work order not found');

    const wo = woDoc.data();
    let contractor = null;

    if (contractorId) {
      const contractorDoc = await db.collection('contractors').doc(contractorId).get();
      if (contractorDoc.exists) contractor = contractorDoc.data();
    }

    const contactName = contractor?.primaryContactName ?? wo.contractorContactPerson ?? 'Sir/Madam';
    const contactPhone = contractor?.primaryContactPhone ?? wo.contractorContactNumber;
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

    logger.info('Contractor invitation payload prepared', invitation);

    // Log invitation on WO
    await woDoc.ref.update({
      contractorInvitationSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // TODO: send via WhatsApp Business API and/or SendGrid
    return { success: true, invitation };
  } catch (err) {
    logger.error('generateContractorInvitation failed', err);
    throw new HttpsError('internal', 'Failed to generate contractor invitation');
  }
});
