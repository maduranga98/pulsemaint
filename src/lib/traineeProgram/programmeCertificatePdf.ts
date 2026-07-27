import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProgrammeDuration, ProgrammeDurationPreset, ProgrammeModuleResult } from '../../types/traineeProgram';
import { formatDurationLabel } from './programmeDuration';

export interface ProgrammeCertificateInput {
  certificateNumber: string;
  companyName: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  durationMonths: ProgrammeDuration;
  durationPreset: ProgrammeDurationPreset;
  startDate: Date;
  completedDate: Date;
  moduleResults: ProgrammeModuleResult[];
  finalMark: number;
  recommendation: string;
  recommendedByName: string;
  recommendedByRole: string;
}

const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const GOLD = { r: 180, g: 138, b: 22 };
const NAVY = { r: 30, g: 58, b: 95 };

/**
 * Builds a professional-looking Certificate of Completion for the trainee
 * programme entirely on the client: gold border, navy header band, the
 * trainee's name as the centerpiece, a modules-completed table, and the
 * authorizing admin's name rendered in a bold script (italic) font to read
 * as a signature.
 */
export function buildProgrammeCertificatePdf(input: ProgrammeCertificateInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;

  // Outer decorative border
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(2.5);
  doc.rect(20, 20, pageWidth - 40, pageHeight - 40);
  doc.setLineWidth(0.75);
  doc.rect(28, 28, pageWidth - 56, pageHeight - 56);

  let y = 78;

  // Company name / header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text((input.companyName || 'PulseMaint').toUpperCase(), pageWidth / 2, y, { align: 'center' });

  y += 30;
  doc.setFont('times', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('Certificate of Completion', pageWidth / 2, y, { align: 'center' });

  y += 16;
  doc.setDrawColor(GOLD.r, GOLD.g, GOLD.b);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 90, y, pageWidth / 2 + 90, y);

  y += 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('This certifies that', pageWidth / 2, y, { align: 'center' });

  y += 34;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(26);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.traineeName, pageWidth / 2, y, { align: 'center' });

  if (input.traineeEmployeeId) {
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`Employee ID: ${input.traineeEmployeeId}`, pageWidth / 2, y, { align: 'center' });
  }

  y += 26;
  const durationLabel = formatDurationLabel(input.durationPreset, input.durationMonths);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `has successfully completed the ${durationLabel} Trainee Training Programme`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );
  y += 16;
  doc.text(
    `from ${input.startDate.toLocaleDateString('en-GB')} to ${input.completedDate.toLocaleDateString('en-GB')}, with a final mark of ${input.finalMark}%.`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  y += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('Modules Completed', marginX, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Month', 'Module', 'Score']],
    body: input.moduleResults.map((r) => [String(r.month), r.moduleName, `${r.score}%`]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 58, 95] },
    columnStyles: { 0: { cellWidth: 60 }, 2: { cellWidth: 60 } },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  if (y > pageHeight - 140) {
    doc.addPage('a4', 'landscape');
    y = 60;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('Recommendation', marginX, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const lines = doc.splitTextToSize(input.recommendation, pageWidth - marginX * 2);
  doc.text(lines, marginX, y);
  y += lines.length * 12 + 20;

  // Footer row: certificate number + issue date on the left, admin
  // signature block on the right.
  const footerY = Math.max(y + 10, pageHeight - 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`Certificate No. ${input.certificateNumber}`, marginX, footerY);
  doc.text(`Issued: ${new Date().toLocaleDateString('en-GB')}`, marginX, footerY + 14);

  const sigX = pageWidth - marginX - 200;
  // Signature rendered in a bold script (italic) font to read as a
  // handwritten authorization by the admin/plant manager/HR officer.
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(22);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(input.recommendedByName, sigX + 100, footerY - 10, { align: 'center' });

  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.setLineWidth(0.75);
  doc.line(sigX, footerY, sigX + 200, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.recommendedByName, sigX + 100, footerY + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(input.recommendedByRole, sigX + 100, footerY + 24, { align: 'center' });

  return doc;
}
