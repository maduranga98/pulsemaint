import { getFunctions, httpsCallable } from 'firebase/functions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateCertificatePayload {
  assignmentId: string;
}

interface GenerateCertificateResponse {
  success: boolean;
  certificateId?: string;
}

interface ComplianceReportFilters {
  department?: string;
  machineTypeId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface GenerateComplianceReportPayload {
  companyId: string;
  filters: ComplianceReportFilters;
}

interface GenerateComplianceReportResponse {
  pdfUrl: string;
}

// ---------------------------------------------------------------------------
// Certificate Generation
// ---------------------------------------------------------------------------

/**
 * Triggers the Cloud Function that generates a training certificate PDF for
 * the given assignment and stores the result in Firestore + Storage.
 *
 * @param assignmentId - Firestore ID of the TrainingAssignment document.
 */
export async function triggerCertificateGeneration(
  assignmentId: string
): Promise<void> {
  const functions = getFunctions();
  const generateCertificate = httpsCallable<
    GenerateCertificatePayload,
    GenerateCertificateResponse
  >(functions, 'generateTrainingCertificate');

  await generateCertificate({ assignmentId });
}

// ---------------------------------------------------------------------------
// Compliance Report PDF
// ---------------------------------------------------------------------------

/**
 * Triggers the Cloud Function that generates a compliance report PDF and
 * returns its publicly accessible download URL from Firebase Storage.
 *
 * @param companyId - Company whose data to include.
 * @param filters   - Optional filters: department, machineTypeId, dateRange.
 * @returns         - The download URL of the generated PDF.
 */
export async function generateComplianceReportPdf(
  companyId: string,
  filters: ComplianceReportFilters
): Promise<string> {
  const functions = getFunctions();
  const generateReport = httpsCallable<
    GenerateComplianceReportPayload,
    GenerateComplianceReportResponse
  >(functions, 'generateComplianceReportPdf');

  const result = await generateReport({ companyId, filters });
  return result.data.pdfUrl;
}
