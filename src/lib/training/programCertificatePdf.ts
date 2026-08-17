import { jsPDF } from 'jspdf';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';
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

const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const GOLD = { r: 180, g: 138, b: 22 };
const NAVY = { r: 30, g: 58, b: 95 };

/**
 * Certificate of Completion for a trainee's assigned training program
 * (`programAssignments`), on the company's own letterhead — same visual
 * structure as the module certificate (certificatePdf.ts) and the trainee
 * programme certificate (programmeCertificatePdf.ts): A4 portrait, gold
 * border, the trainee's name as the centerpiece, and the authorizer's
 * captured digital signature.
 */
export function buildProgramCertificatePdf(input: ProgramCertificatePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centre = pageWidth / 2;
  const marginX = 56;

  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(2.5);
  doc.rect(20, 20, pageWidth - 40, pageHeight - 40);
  doc.setLineWidth(0.75);
  doc.rect(28, 28, pageWidth - 56, pageHeight - 56);

  let y = 74;

  if (input.companyLogoDataUrl) {
    try {
      doc.addImage(input.companyLogoDataUrl, imageFormatFromDataUrl(input.companyLogoDataUrl), centre - 24, y - 10, 48, 48);
      y += 46;
    } catch {
      // Malformed/unsupported image data — carry on without the logo.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text((input.companyName || 'FirmiCore').toUpperCase(), centre, y + 12, { align: 'center' });

  const contactBits = [input.companyAddress, input.companyPhone, input.companyEmail]
    .map((v) => (v ?? '').trim())
    .filter(Boolean);
  if (contactBits.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(contactBits.join('  ·  '), centre, y + 25, { align: 'center' });
  }

  y += 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('Certificate of Completion', centre, y, { align: 'center' });

  y += 14;
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(1);
  doc.line(centre - 90, y, centre + 90, y);

  y += 26;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('This certifies that', centre, y, { align: 'center' });

  y += 30;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(22);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.traineeName, centre, y, { align: 'center' });

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `has successfully completed the training program`,
    centre,
    y,
    { align: 'center' },
  );
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.programName, centre, y, { align: 'center' });

  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('Modules Completed', marginX, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  input.moduleResults.forEach((r) => {
    if (y > pageHeight - 150) {
      doc.addPage('a4', 'portrait');
      y = 60;
    }
    doc.text(`•  ${r.moduleName}`, marginX + 4, y, { maxWidth: pageWidth - marginX * 2 - 4 });
    y += 16;
  });

  if (input.note?.trim()) {
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text('Note', marginX, y);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(input.note.trim(), pageWidth - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 20;
  } else {
    y += 20;
  }

  // Footer block: certificate number left, signature right.
  const footerY = Math.max(y + 20, pageHeight - 110);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`Certificate No. ${input.certificateNumber}`, marginX, footerY);
  doc.text(`Issued: ${input.issuedAt.toLocaleDateString('en-GB')}`, marginX, footerY + 14);

  const sigWidth = 180;
  const sigX = pageWidth - marginX - sigWidth;
  if (input.signatureImageDataUrl) {
    try {
      doc.addImage(input.signatureImageDataUrl, 'PNG', sigX + 30, footerY - 44, 120, 38);
    } catch {
      doc.setFont('times', 'bolditalic');
      doc.setFontSize(18);
      doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      doc.text(input.signedOffByName, sigX + sigWidth / 2, footerY - 10, { align: 'center' });
    }
  } else {
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(18);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text(input.signedOffByName, sigX + sigWidth / 2, footerY - 10, { align: 'center' });
  }

  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.75);
  doc.line(sigX, footerY, sigX + sigWidth, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.signedOffByName, sigX + sigWidth / 2, footerY + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text((input.signedOffByRole || '').replace(/_/g, ' '), sigX + sigWidth / 2, footerY + 25, { align: 'center' });

  if (input.companyDescription?.trim()) {
    doc.setFontSize(7);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(input.companyDescription.trim(), centre, pageHeight - 40, {
      align: 'center',
      maxWidth: pageWidth - marginX * 2,
    });
  }

  return doc;
}

export function buildProgramCertificateNumber(issuedAt: Date = new Date()): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PCERT-${issuedAt.getFullYear()}-${suffix}`;
}

export function programCertificateFileName(traineeName: string, certificateNumber: string): string {
  const safeName = traineeName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'certificate';
  const safeNumber = certificateNumber.replace(/[^a-z0-9-]+/gi, '') || 'cert';
  return `${safeName}_${safeNumber}.pdf`;
}
