import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TERMINAL_STATUSES = ['completed', 'quick_fix', 'escalated'];

export const attachTriageToBreakdown = functions.firestore
  .document('triageSessions/{sessionId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return;
    if (before.status === after.status) return;
    if (!TERMINAL_STATUSES.includes(after.status as string)) return;
    if (!after.breakdownTicketId) return;

    try {
      await db.collection('breakdownTickets').doc(after.breakdownTicketId as string).update({
        triageSessionId: change.after.id,
        triageStatus: after.status,
        triageOutcome: after.outcomeType ?? null,
        triageCompletedAt: after.completedAt ?? admin.firestore.Timestamp.now(),
      });
      console.log('Attached triage to breakdown ticket', after.breakdownTicketId);
    } catch (err) {
      console.error('attachTriageToBreakdown error:', err);
    }
  });
