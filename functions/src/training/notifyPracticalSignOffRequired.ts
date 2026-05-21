import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

export const notifyPracticalSignOffRequired = functions.firestore
  .document('trainingAssignments/{assignmentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Record<string, unknown>;
    const after = change.after.data() as Record<string, unknown>;

    if (before['status'] === after['status'] || after['status'] !== 'awaiting_practical') {
      return null;
    }

    const db = admin.firestore();
    const supervisorId = after['assignedBy'] as string | undefined;
    if (!supervisorId) return null;

    const supervisorDoc = await db.doc(`users/${supervisorId}`).get();
    const supervisorData = supervisorDoc.data() as Record<string, unknown> | undefined;
    const fcmToken = supervisorData?.['fcmToken'] as string | undefined;

    if (!fcmToken) {
      functions.logger.info(`No FCM token for supervisor ${supervisorId}`);
      return null;
    }

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: 'Practical Sign-Off Required',
        body: `${after['traineeName']} passed the ${after['moduleName']} quiz. Conduct practical assessment.`,
      },
      data: {
        type: 'practical_sign_off',
        assignmentId: context.params['assignmentId'] as string,
        traineeId: after['traineeId'] as string,
        moduleId: after['moduleId'] as string,
      },
    };

    try {
      await admin.messaging().send(message);
    } catch (err) {
      functions.logger.error('FCM send failed:', err);
    }

    return null;
  });
