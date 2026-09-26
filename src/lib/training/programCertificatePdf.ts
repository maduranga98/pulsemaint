import type { jsPDF } from 'jspdf';
import { buildClassicCertificatePdf } from '@/lib/pdf/classicCertificateLayout';
import { INK, MUTED, formatCertificateDate, type TextRun } from '@/lib/pdf/certificateDesign';
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
 * (`programAssignments`), in the same Classic A4-landscape design as the
 * module certificate (src/lib/training/certificatePdf.ts): company logo and
 * name, the trainee's name in script, the program and its completed modules
 * as the citation, and the signing-off manager's captured signature.
 */
export async function buildProgramCertificatePdf(input: ProgramCertificatePdfInput): Promise<jsPDF> {
  const scores = input.moduleResults.map((r) => r.score).filter((n) => Number.isFinite(n));
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const modules = input.moduleResults.map((r) => r.moduleName).filter(Boolean);

  const citation: TextRun[] = [
    { text: 'In recognition of successfully completing the training program ', key: 'manrope', color: MUTED },
    { text: input.programName, key: 'manropeBold', color: INK },
  ];
  if (average !== null) {
    citation.push(
      { text: ' with an average assessment score of ', key: 'manrope', color: MUTED },
      { text: `${average}%`, key: 'manropeBold', color: INK },
    );
  }
  citation.push({ text: '.', key: 'manrope', color: MUTED });

  return buildClassicCertificatePdf({
    companyName: input.companyName,
    companyLogoDataUrl: input.companyLogoDataUrl,
    subtitle: 'OF COMPLETION',
    recipientName: input.traineeName,
    citation,
    detailLines: [
      modules.length ? `Modules completed (${modules.length}): ${modules.join(', ')}` : '',
      input.note?.trim() ? `Note: ${input.note.trim()}` : '',
    ],
    dateValue: formatCertificateDate(input.issuedAt),
    dateLabel: 'Date Issued',
    signatoryName: input.signedOffByName,
    signatoryCaption: (input.signedOffByRole || 'Authorised Signatory').replace(/_/g, ' '),
    signatureImageDataUrl: input.signatureImageDataUrl,
    certificateNumber: input.certificateNumber,
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
