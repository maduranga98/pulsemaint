import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

export const checkRetrainingTrigger = functions.firestore
  .document('breakdownTickets/{ticketId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Record<string, unknown>;
    const after = change.after.data() as Record<string, unknown>;

    if (before['status'] === after['status'] || after['status'] !== 'closed') return null;

    const machineId = after['machineId'] as string | undefined;
    const companyId = after['companyId'] as string | undefined;
    if (!machineId || !companyId) return null;

    const db = admin.firestore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const breakdownsSnap = await db.collection('breakdownTickets')
      .where('machineId', '==', machineId)
      .where('companyId', '==', companyId)
      .where('status', '==', 'closed')
      .where('closedAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();

    if (breakdownsSnap.size < 3) return null;

    const machineDoc = await db.doc(`machines/${machineId}`).get();
    const machineName = (machineDoc.data()?.['name'] as string | undefined) ?? machineId;

    const certsSnap = await db.collection('trainingCertificates')
      .where('companyId', '==', companyId)
      .where('machineId', '==', machineId)
      .where('isRevoked', '==', false)
      .get();

    if (certsSnap.empty) return null;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const reason = `3+ breakdowns on ${machineName} in 30 days`;
    const batch = db.batch();

    for (const cert of certsSnap.docs) {
      const certData = cert.data() as Record<string, unknown>;
      const assignmentSnap = await db.collection('trainingAssignments')
        .where('traineeId', '==', certData['traineeId'])
        .where('moduleId', '==', certData['moduleId'])
        .where('status', '==', 'certified')
        .limit(1)
        .get();

      if (!assignmentSnap.empty) {
        batch.update(assignmentSnap.docs[0].ref, {
          status: 'retraining_required',
          retrainingReason: reason,
          retrainingTriggeredAt: now,
        });
      }
    }

    await batch.commit();
    return null;
  });
