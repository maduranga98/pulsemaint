import { jsPDF } from 'jspdf';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';

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
  /** The signing-off manager's captured signature. Falls back to a script-font name if absent. */
  signatureImageDataUrl?: string | null;

  companyName: string;
  companyDescription?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyLogoDataUrl?: string | null;
}

const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const NAVY = { r: 30, g: 58, b: 95 };
const GOLD = { r: 180, g: 142, b: 52 };

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * A4 landscape training certificate on the company's own letterhead — logo,
 * name, and contact details identify the issuing company, with a double gold
 * border, the trainee's name as the centrepiece, and a signature block for
 * the manager who signed off the practical assessment.
 *
 * Built entirely client-side so a trainee can download their certificate the
 * moment it is issued, without waiting on a Cloud Function to render one.
 */
export function buildTrainingCertificatePdf(input: TrainingCertificatePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centre = pageWidth / 2;

  // Double border
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(3);
  doc.rect(24, 24, pageWidth - 48, pageHeight - 48);
  doc.setLineWidth(0.75);
  doc.rect(33, 33, pageWidth - 66, pageHeight - 66);

  let y = 70;

  // Letterhead — logo left, company details centred beneath.
  if (input.companyLogoDataUrl) {
    try {
      doc.addImage(
        input.companyLogoDataUrl,
        imageFormatFromDataUrl(input.companyLogoDataUrl),
        centre - 26,
        y - 12,
        52,
        52,
      );
      y += 50;
    } catch {
      // Malformed/unsupported image data — carry on without the logo rather
      // than failing the download.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.companyName, centre, y + 14, { align: 'center' });

  const contactBits = [input.companyAddress, input.companyPhone, input.companyEmail]
    .map((v) => (v ?? '').trim())
    .filter(Boolean);
  if (contactBits.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(contactBits.join('  ·  '), centre, y + 28, { align: 'center' });
  }

  y += 58;

  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(0.75);
  doc.line(centre - 120, y, centre + 120, y);

  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('CERTIFICATE OF TRAINING', centre, y, { align: 'center' });

  y += 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('This is to certify that', centre, y, { align: 'center' });

  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.traineeName, centre, y, { align: 'center' });

  // Underline sized to the name.
  const nameWidth = doc.getTextWidth(input.traineeName);
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(0.75);
  doc.line(centre - nameWidth / 2 - 16, y + 8, centre + nameWidth / 2 + 16, y + 8);

  if (input.traineeDesignation) {
    y += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(input.traineeDesignation, centre, y, { align: 'center' });
  }

  y += 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('has successfully completed the training module', centre, y, { align: 'center' });

  y += 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.moduleName, centre, y, { align: 'center', maxWidth: pageWidth - 160 });

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    `${input.subjectLabel}: ${input.subjectValue || '—'}   ·   Assessment score: ${input.quizScore}%`,
    centre,
    y,
    { align: 'center' },
  );

  if (input.practicalObservations?.trim()) {
    y += 18;
    doc.setFontSize(9);
    doc.text(`Practical assessment: ${input.practicalObservations.trim()}`, centre, y, {
      align: 'center',
      maxWidth: pageWidth - 200,
    });
  }

  // Footer block: certificate number left, signature right.
  const footerY = pageHeight - 92;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('CERTIFICATE NO.', 70, footerY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.certificateNumber, 70, footerY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`Issued ${formatDate(input.issuedAt)}`, 70, footerY + 32);
  if (input.expiryDate) {
    doc.text(`Valid until ${formatDate(input.expiryDate)}`, 70, footerY + 45);
  }

  const signX = pageWidth - 70;
  if (input.signatureImageDataUrl) {
    // The authorizer's actual digital signature, captured at sign-off time.
    try {
      doc.addImage(input.signatureImageDataUrl, 'PNG', signX - 150, footerY - 30, 110, 34);
    } catch {
      // A malformed data URL shouldn't block certificate generation — fall
      // back to the printed name below the signature line instead.
    }
  }
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.75);
  doc.line(signX - 170, footerY + 12, signX, footerY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.issuedByName || '—', signX, footerY + 27, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('Authorised signatory', signX, footerY + 40, { align: 'right' });

  if (input.companyDescription?.trim()) {
    doc.setFontSize(7);
    doc.text(input.companyDescription.trim(), centre, pageHeight - 44, {
      align: 'center',
      maxWidth: pageWidth - 160,
    });
  }

  return doc;
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
