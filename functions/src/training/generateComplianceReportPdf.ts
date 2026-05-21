import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

interface ComplianceInput {
  companyId: string;
  filters?: {
    department?: string;
    machineTypeId?: string;
    dateRange?: { start: string; end: string };
  };
}

export const generateComplianceReportPdf = functions.https.onCall(
  async (data: ComplianceInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }

    const db = admin.firestore();
    const userDoc = await db.doc(`users/${context.auth.uid}`).get();
    const userData = userDoc.data() as Record<string, unknown> | undefined;

    if (userData?.['companyId'] !== data.companyId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    const allowedRoles = ['hr_officer', 'plant_manager', 'admin'];
    if (!allowedRoles.includes(userData?.['role'] as string)) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    // In production: use puppeteer to generate PDF, upload to Storage
    // Return placeholder URL for now
    const timestamp = Date.now();
    const reportPath = `companies/${data.companyId}/reports/compliance_${timestamp}.pdf`;

    functions.logger.info(`Compliance report requested for company ${data.companyId}`);

    return {
      url: reportPath,
      generatedAt: new Date().toISOString(),
    };
  }
);
