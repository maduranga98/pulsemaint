import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

export const generateTrainingCertificate = functions.firestore
  .document('trainingAssignments/{assignmentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Record<string, unknown>;
    const after = change.after.data() as Record<string, unknown>;

    if (before['status'] === after['status'] || after['status'] !== 'certified') return null;
    if ((after['practicalSignOff'] as Record<string, unknown>)?.['passed'] !== true) return null;

    const assignmentId = context.params['assignmentId'];
    const db = admin.firestore();

    const moduleDoc = await db.doc(`trainingModules/${after['moduleId']}`).get();
    const traineeDoc = await db.doc(`users/${after['traineeId']}`).get();
    const companyDoc = after['companyId']
      ? await db.doc(`companies/${after['companyId']}`).get()
      : null;

    const moduleData = moduleDoc.data() ?? {};
    const traineeData = traineeDoc.data() ?? {};
    const companyData = companyDoc?.data() ?? {};

    const counterRef = db.doc(`certCounters/${after['companyId']}`);
    const certNumber = await db.runTransaction(async (tx) => {
      const counter = await tx.get(counterRef);
      const count = ((counter.data()?.['count'] as number) ?? 0) + 1;
      tx.set(counterRef, { count }, { merge: true });
      return `CERT-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    });

    const certRef = db.collection('trainingCertificates').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const signOff = after['practicalSignOff'] as Record<string, unknown>;

    await certRef.set({
      id: certRef.id,
      certificateNumber: certNumber,
      companyId: after['companyId'] ?? '',
      companyName: companyData['name'] ?? '',
      traineeId: after['traineeId'] ?? '',
      traineeName: after['traineeName'] ?? '',
      traineeNic: traineeData['employeeId'] ?? '',
      traineeDesignation: traineeData['jobTitle'] ?? 'Machine Operator',
      moduleId: after['moduleId'] ?? '',
      moduleName: after['moduleName'] ?? '',
      machineId: after['machineId'] ?? '',
      machineName: after['machineName'] ?? '',
      machineType: moduleData['machineTypeId'] ?? '',
      issuedBy: signOff?.['signedOffBy'] ?? '',
      issuedByName: signOff?.['signedOffByName'] ?? '',
      issuedAt: now,
      expiryDate: null,
      isExpired: false,
      quizScore: (after['bestScore'] as number) ?? 0,
      practicalObservations: signOff?.['observations'] ?? '',
      pdfUrl: '',
      assignmentId,
      isRevoked: false,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
    });

    await change.after.ref.update({
      certificateId: certRef.id,
      certifiedAt: now,
    });

    return null;
  });
