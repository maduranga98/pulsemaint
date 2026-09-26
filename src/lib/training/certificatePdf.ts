import type { jsPDF } from 'jspdf';
import { buildLandscapeCertificatePdf } from '@/lib/pdf/landscapeCertificateLayout';
import { formatCertificateDate } from '@/lib/pdf/certificateDesign';

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
 * A4 landscape training certificate in the navy side-panel design (see
 * src/lib/pdf/landscapeCertificateLayout.ts): the issuing company's logo,
 * name and the certificate ID in the side panel, the trainee's name as the
 * centrepiece, the module as the completed item with its training details
 * (machine/provider, score, validity) as a checklist, and a date · award
 * seal · signature footer carrying the signing-off manager's signature.
 *
 * Built entirely client-side so a trainee can download their certificate the
 * moment it is issued, without waiting on a Cloud Function to render one.
 */
export async function buildTrainingCertificatePdf(input: TrainingCertificatePdfInput): Promise<jsPDF> {
  const details = [
    `${input.subjectLabel}: ${input.subjectValue || '—'}`,
    `Assessment score: ${input.quizScore}%`,
    input.expiryDate ? `Valid until ${formatCertificateDate(input.expiryDate)}` : '',
    input.practicalObservations?.trim() ? 'Practical assessment passed' : '',
  ];

  return buildLandscapeCertificatePdf({
    companyName: input.companyName,
    companyLogoDataUrl: input.companyLogoDataUrl,
    subtitle: 'OF TRAINING',
    recipientName: input.traineeName,
    recipientCaption: input.traineeDesignation,
    completedLine: 'HAS SUCCESSFULLY COMPLETED THE TRAINING MODULE',
    title: input.moduleName,
    listHeading: 'TRAINING DETAILS',
    listItems: details,
    dateValue: formatCertificateDate(input.issuedAt),
    dateLabel: 'Date',
    signatoryName: input.issuedByName,
    signatoryCaption: 'Signature',
    signatureImageDataUrl: input.signatureImageDataUrl,
    certificateNumber: input.certificateNumber,
    awardYear: String(input.issuedAt.getFullYear()),
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
