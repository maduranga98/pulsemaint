import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

export const sendTrainingReminders = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const upcomingSnap = await db.collection('trainingAssignments')
      .where('status', 'in', ['not_started', 'in_progress'])
      .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(threeDaysFromNow))
      .where('dueDate', '>=', admin.firestore.Timestamp.fromDate(now))
      .get();

    const overdueSnap = await db.collection('trainingAssignments')
      .where('status', 'in', ['not_started', 'in_progress'])
      .where('dueDate', '<', admin.firestore.Timestamp.fromDate(now))
      .get();

    functions.logger.info(
      `Training reminders: ${upcomingSnap.size} upcoming, ${overdueSnap.size} overdue`
    );

    // TODO: Send FCM push notifications + emails per trainee
    return null;
  });
