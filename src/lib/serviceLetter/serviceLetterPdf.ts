import { jsPDF } from 'jspdf';
import type { TFunction } from 'i18next';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';
import { registerUnicodeFont } from '@/utils/reports/pdf/pdfFonts';
import { formatLongDate } from '@/lib/i18nDate';

export interface ServiceLetterInput {
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyDescription?: string | null;
  companyLogoDataUrl?: string | null;

  signatureImageDataUrl?: string | null;

  letterDate: Date;
  subject: string;
  addressedTo: string;
  body: string;
  remarks: string;

  issuedByName: string;
  issuedByRole: string;
}

const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const NAVY = { r: 30, g: 58, b: 95 };

/**
 * Builds a professional Service Letter as a letterhead document: company
 * logo + description in the header, a customizable body paragraph, and a
 * signature block for the issuing officer. Deliberately carries no employee
 * details block — the body paragraph is expected to carry whatever facts
 * (name, role, join date) the letter needs.
 */
export interface ServiceLetterPdfResult {
  doc: jsPDF;
  /** False when a logo data URL was supplied but jsPDF couldn't embed it (malformed/unsupported image). */
  logoEmbedded: boolean;
}

export async function buildServiceLetterPdf(input: ServiceLetterInput, t?: TFunction): Promise<ServiceLetterPdfResult> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  // The letter body/subject/remarks are free-text fields the issuer can
  // type or edit (including a translated default template — see
  // ServiceLetterModal.tsx), so jsPDF's default Latin-1-only fonts corrupt
  // any character outside that range. Embed a Unicode font matching the
  // current app language — see pdfFonts.ts — instead of the built-in
  // Helvetica/Times, so the exported PDF's script matches the live UI.
  const fontName = await registerUnicodeFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 56;
  let y = 56;
  let logoEmbedded = false;

  // Letterhead
  if (input.companyLogoDataUrl) {
    try {
      doc.addImage(input.companyLogoDataUrl, imageFormatFromDataUrl(input.companyLogoDataUrl), marginX, y - 20, 48, 48);
      logoEmbedded = true;
    } catch {
      // Malformed/unsupported image data — skip the logo rather than fail
      // the whole letter generation.
    }
  }

  const headerX = logoEmbedded ? marginX + 60 : marginX;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.companyName || t?.('common.settings.serviceLetter.pdf.company', { defaultValue: 'Company' }) || 'Company', headerX, y);

  let headerY = y + 16;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const contactLine = [input.companyAddress, input.companyPhone, input.companyEmail].filter(Boolean).join('  |  ');
  if (contactLine) {
    doc.text(contactLine, headerX, headerY, { maxWidth: pageWidth - headerX - marginX });
    headerY += 14;
  }
  if (input.companyDescription) {
    const descLines = doc.splitTextToSize(input.companyDescription, pageWidth - headerX - marginX);
    doc.text(descLines, headerX, headerY);
    headerY += descLines.length * 11;
  }

  y = Math.max(y + 40, headerY + 12);
  doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, pageWidth - marginX, y);

  y += 34;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(formatLongDate(input.letterDate), pageWidth - marginX, y, { align: 'right' });

  y += 24;
  doc.text(input.addressedTo || t?.('common.settings.serviceLetter.pdf.toWhomItMayConcern', { defaultValue: 'To Whom It May Concern' }) || 'To Whom It May Concern', marginX, y);

  y += 26;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(11);
  const subjectLabel = t?.('common.settings.serviceLetter.pdf.subjectLabel', { defaultValue: 'Subject: {{subject}}' }) ?? 'Subject: {{subject}}';
  doc.text(subjectLabel.replace('{{subject}}', input.subject), marginX, y);

  y += 26;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  const bodyLines = doc.splitTextToSize(input.body, pageWidth - marginX * 2);
  doc.text(bodyLines, marginX, y, { lineHeightFactor: 1.5 });
  y += bodyLines.length * 15 + 16;

  if (input.remarks.trim()) {
    y += 10;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(t?.('common.settings.serviceLetter.pdf.remarksHeading', { defaultValue: 'Remarks' }) || 'Remarks', marginX, y);
    y += 16;
    doc.setFont(fontName, 'normal');
    doc.setTextColor(30, 41, 59);
    const remarkLines = doc.splitTextToSize(input.remarks, pageWidth - marginX * 2);
    doc.text(remarkLines, marginX, y);
    y += remarkLines.length * 14;
  }

  // Signature block
  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = Math.max(y + 50, pageHeight - 140);

  if (input.signatureImageDataUrl) {
    try {
      doc.addImage(
        input.signatureImageDataUrl,
        imageFormatFromDataUrl(input.signatureImageDataUrl),
        marginX,
        sigY - 42,
        140,
        36
      );
    } catch {
      // Malformed/unsupported signature image — fall back to the printed name below the line.
    }
  } else {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text(input.issuedByName, marginX, sigY - 8);
  }

  doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setLineWidth(0.75);
  doc.line(marginX, sigY, marginX + 200, sigY);

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.issuedByName, marginX, sigY + 14);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.issuedByRole, marginX, sigY + 26);

  return { doc, logoEmbedded };
}
