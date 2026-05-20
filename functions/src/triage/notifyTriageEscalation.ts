import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const notifyTriageEscalation = functions.firestore
  .document('triageSessions/{sessionId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return;
    if (before.status === after.status) return;
    if (after.status !== 'escalated') return;

    try {
      const companySnap = await db
        .collection('userProfiles')
        .where('companyId', '==', after.companyId)
        .where('role', '==', 'plant_manager')
        .limit(5)
        .get();

      const tokens: string[] = [];
      companySnap.docs.forEach((d) => {
        const fcmToken = d.data().fcmToken as string | undefined;
        if (fcmToken) tokens.push(fcmToken);
      });

      if (tokens.length === 0) return;

      const payload: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: '🚨 Triage Escalated',
          body: `Machine: ${after.machineName as string} — ${after.escalatedReason as string}`,
        },
        data: {
          sessionId: change.after.id,
          type: 'triage_escalation',
        },
      };

      await admin.messaging().sendEachForMulticast(payload);
      console.log('Sent escalation notification to', tokens.length, 'tokens');
    } catch (err) {
      console.error('notifyTriageEscalation error:', err);
    }
  });
