import type { jsPDF } from 'jspdf';
import { buildLandscapeCertificatePdf } from '@/lib/pdf/landscapeCertificateLayout';
import { formatCertificateDate } from '@/lib/pdf/certificateDesign';
import type { ProgramCertificateModuleResult } from '@/types/trainingProgram';

export interface ProgramCertificatePdfInput {
  certificateNumber: string;
  companyName: string;
  companyDescription?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyLogoDataUrl?: string | null;
  traineeName: string;
  programName: string;
  issuedAt: Date;
  moduleResults: ProgramCertificateModuleResult[];
  note?: string | null;
  signedOffByName: string;
  signedOffByRole: string;
  /** PNG data URL of the authorizer's digital signature, if captured. */
  signatureImageDataUrl?: string | null;
}

/**
 * Certificate of Completion for a trainee's assigned training program
 * (`programAssignments`), in the same navy side-panel landscape design as
 * the module certificate (src/lib/training/certificatePdf.ts): the program
 * as the completed item, its modules as a checklist, and the signing-off
 * manager's captured signature.
 */
export async function buildProgramCertificatePdf(input: ProgramCertificatePdfInput): Promise<jsPDF> {
  return buildLandscapeCertificatePdf({
    companyName: input.companyName,
    companyLogoDataUrl: input.companyLogoDataUrl,
    subtitle: 'OF COMPLETION',
    recipientName: input.traineeName,
    completedLine: 'HAS SUCCESSFULLY COMPLETED THE PROGRAM',
    title: input.programName,
    listHeading: 'COMPLETED MODULES',
    listItems: input.moduleResults.map((r) => r.moduleName).filter(Boolean),
    dateValue: formatCertificateDate(input.issuedAt),
    dateLabel: 'Date',
    signatoryName: input.signedOffByName,
    signatoryCaption: (input.signedOffByRole || 'Signature').replace(/_/g, ' '),
    signatureImageDataUrl: input.signatureImageDataUrl,
    certificateNumber: input.certificateNumber,
    awardYear: String(input.issuedAt.getFullYear()),
  });
}

export function buildProgramCertificateNumber(issuedAt: Date = new Date()): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PCERT-${issuedAt.getFullYear()}-${suffix}`;
}

export function programCertificateFileName(traineeName: string, certificateNumber: string | null | undefined): string {
  const safeName = (traineeName || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'certificate';
  const safeNumber = (certificateNumber || '').replace(/[^a-z0-9-]+/gi, '') || 'cert';
  return `${safeName}_${safeNumber}.pdf`;
}
