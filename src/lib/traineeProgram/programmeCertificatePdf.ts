import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProgrammeDuration, ProgrammeModuleResult } from '../../types/traineeProgram';

export interface ProgrammeCertificateInput {
  certificateNumber: string;
  companyName: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  durationMonths: ProgrammeDuration;
  startDate: Date;
  completedDate: Date;
  moduleResults: ProgrammeModuleResult[];
  finalMark: number;
  recommendation: string;
  recommendedByName: string;
  recommendedByRole: string;
}

/** Builds the trainee programme completion certificate entirely on the client. */
export function buildProgrammeCertificatePdf(input: ProgrammeCertificateInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 60;

  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Certificate of Completion', marginX, y);

  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(input.companyName || 'PulseMaint', marginX, y);
  doc.text(`Certificate No. ${input.certificateNumber}`, 420, y);

  y += 30;
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`This certifies that`, marginX, y);
  y += 22;
  doc.setFontSize(18);
  doc.text(input.traineeName, marginX, y);
  if (input.traineeEmployeeId) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Employee ID: ${input.traineeEmployeeId}`, marginX, y + 14);
    y += 14;
  }

  y += 24;
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `has successfully completed the ${input.durationMonths}-month Trainee Training Programme,`,
    marginX,
    y,
  );
  y += 16;
  doc.text(
    `from ${input.startDate.toLocaleDateString('en-GB')} to ${input.completedDate.toLocaleDateString('en-GB')}, with a final mark of ${input.finalMark}%.`,
    marginX,
    y,
  );

  y += 24;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Modules Completed', marginX, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Month', 'Module', 'Score']],
    body: input.moduleResults.map((r) => [String(r.month), r.moduleName, `${r.score}%`]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 0: { cellWidth: 60 }, 2: { cellWidth: 60 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  if (y > 680) {
    doc.addPage();
    y = 60;
  }

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Recommendation', marginX, y);
  y += 16;
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const lines = doc.splitTextToSize(input.recommendation, 500);
  doc.text(lines, marginX, y);
  y += lines.length * 12 + 30;

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('_____________________________', marginX, y);
  y += 14;
  doc.text(input.recommendedByName, marginX, y);
  y += 12;
  doc.setTextColor(100, 116, 139);
  doc.text(input.recommendedByRole, marginX, y);

  return doc;
}
