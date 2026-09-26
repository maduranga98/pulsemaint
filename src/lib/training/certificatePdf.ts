import type { jsPDF } from 'jspdf';
import { buildClassicCertificatePdf } from '@/lib/pdf/classicCertificateLayout';
import { INK, MUTED, formatCertificateDate } from '@/lib/pdf/certificateDesign';

export interface TrainingCertificatePdfInput {
  certificateNumber: string;
  traineeName: string;
  traineeDesignation?: string | null;
  moduleName: string;
  /** Machine for internal training, provider for offboard/external training. */
  subjectLabel: string;
  subjectValue: string;
  quizScore: number;
  issuedAt: Date;
  expiryDate?: Date | null;
  issuedByName: string;
  practicalObservations?: string | null;
  /** The signing-off manager's captured signature, drawn above the signature line when present. */
  signatureImageDataUrl?: string | null;

  companyName: string;
  companyDescription?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyLogoDataUrl?: string | null;
}

/**
 * A4 landscape training certificate in the Classic navy/sky-blue design (see
 * src/lib/pdf/classicCertificateLayout.ts): the issuing company's logo and
 * name at the top, the trainee's name in script as the centrepiece, the
 * module, machine/provider and assessment score as the citation, and a
 * date · seal · signature footer carrying the signing-off manager's captured
 * signature.
 *
 * Built entirely client-side so a trainee can download their certificate the
 * moment it is issued, without waiting on a Cloud Function to render one.
 */
export async function buildTrainingCertificatePdf(input: TrainingCertificatePdfInput): Promise<jsPDF> {
  const details = [
    `${input.subjectLabel}: ${input.subjectValue || '—'}` +
      (input.expiryDate ? `   ·   Valid until ${formatCertificateDate(input.expiryDate)}` : ''),
    input.practicalObservations?.trim() ? `Practical assessment: ${input.practicalObservations.trim()}` : '',
  ];

  return buildClassicCertificatePdf({
    companyName: input.companyName,
    companyLogoDataUrl: input.companyLogoDataUrl,
    subtitle: 'OF TRAINING',
    recipientName: input.traineeName,
    recipientCaption: input.traineeDesignation,
    citation: [
      { text: 'In recognition of successfully completing the training module ', key: 'manrope', color: MUTED },
      { text: input.moduleName, key: 'manropeBold', color: INK },
      { text: ' with an assessment score of ', key: 'manrope', color: MUTED },
      { text: `${input.quizScore}%`, key: 'manropeBold', color: INK },
      { text: '.', key: 'manrope', color: MUTED },
    ],
    detailLines: details,
    dateValue: formatCertificateDate(input.issuedAt),
    dateLabel: 'Date Issued',
    signatoryName: input.issuedByName,
    signatoryCaption: 'Authorised Signatory',
    signatureImageDataUrl: input.signatureImageDataUrl,
    certificateNumber: input.certificateNumber,
  });
}

/** Certificate number: CERT-<year>-<6 chars>, unique enough per company. */
export function buildCertificateNumber(issuedAt: Date = new Date()): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CERT-${issuedAt.getFullYear()}-${suffix}`;
}

/** Filename for a downloaded certificate — trainee + certificate number. */
export function certificateFileName(traineeName: string, certificateNumber: string): string {
  const safeName = traineeName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'certificate';
  const safeNumber = certificateNumber.replace(/[^a-z0-9-]+/gi, '') || 'cert';
  return `${safeName}_${safeNumber}.pdf`;
}
