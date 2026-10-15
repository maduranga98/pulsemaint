import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TFunction } from 'i18next';
import type { Timestamp } from 'firebase/firestore';
import { registerUnicodeFont, pdfSafeText, isPdfRenderable } from '@/utils/reports/pdf/pdfFonts';
import type { ComplianceMatrixRow, ComplianceStats } from '@/hooks/training/useComplianceData';

interface CompliancePdfInput {
  stats: ComplianceStats;
  matrixRows: ComplianceMatrixRow[];
  moduleHeaders: { moduleId: string; moduleName: string }[];
  companyName?: string | null;
  t: TFunction;
}

function fmt(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return '';
  return ts.toDate().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
}

/**
 * Training Compliance report as a PDF, built in the browser from the same
 * (plant-scoped) matrix the page shows. The old export button called a Cloud
 * Function that only queued a record nothing ever processed, so it produced
 * no file at all.
 */
export async function downloadComplianceReportPdf({ stats, matrixRows, moduleHeaders, companyName, t }: CompliancePdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const fontName = await registerUnicodeFont(doc);
  const tr = (key: string, fallback: string, vars?: Record<string, unknown>) =>
    pdfSafeText(String(t(key, { defaultValue: fallback, ...vars })), fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars?.[k] ?? '')));
  const safe = (text: string, fallback = '') => (isPdfRenderable(text) ? text : fallback);

  const title = tr('common.trainingShared.manager.complianceReport.title', 'Training Compliance Report');
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.text(title, 40, 44);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const sub = [companyName ? safe(companyName) : '', new Date().toLocaleString()].filter(Boolean).join(' · ');
  doc.text(sub, 40, 60);

  doc.setTextColor(15, 23, 42);
  autoTable(doc, {
    startY: 74,
    styles: { font: fontName, fontSize: 9 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [[
      tr('common.trainingShared.manager.complianceReport.pdf.trainees', 'Trainees'),
      tr('common.trainingShared.manager.complianceReport.pdf.certified', 'Certified'),
      tr('common.trainingShared.manager.complianceReport.pdf.notCertified', 'Not certified'),
      tr('common.trainingShared.manager.complianceReport.pdf.expiringSoon', 'Expiring soon'),
      tr('common.trainingShared.manager.complianceReport.pdf.overdue', 'Overdue'),
      tr('common.trainingShared.manager.complianceReport.pdf.retraining', 'Retraining required'),
    ]],
    body: [[stats.totalTrainees, stats.certified, stats.notCertified, stats.expiringSoon, stats.overdueAssignments, stats.retrainingRequired].map(String)],
    margin: { left: 40, right: 40 },
  });

  const statusText = (cell?: ComplianceMatrixRow['modules'][string]): string => {
    if (!cell || cell.status === 'not_assigned') return '–';
    if (cell.status === 'certified') {
      const on = fmt(cell.certifiedAt);
      const exp = fmt(cell.expiryDate ?? null);
      const base = tr('common.trainingShared.manager.complianceReport.pdf.status.certified', 'Certified');
      return [base, on, exp ? tr('common.trainingShared.manager.complianceReport.pdf.expires', 'exp. {{date}}', { date: exp }) : '']
        .filter(Boolean).join('\n');
    }
    if (cell.status === 'expired') return tr('common.trainingShared.manager.complianceReport.pdf.status.expired', 'Expired');
    if (cell.status === 'in_progress') return tr('common.trainingShared.manager.complianceReport.pdf.status.inProgress', 'In progress');
    if (cell.status === 'not_started') return tr('common.trainingShared.manager.complianceReport.pdf.status.notStarted', 'Not started');
    return String(cell.status).replace(/_/g, ' ');
  };

  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  autoTable(doc, {
    startY: lastY + 16,
    styles: { font: fontName, fontSize: 8, cellPadding: 4, valign: 'middle' },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 80 } },
    head: [[
      tr('common.trainingShared.manager.complianceReport.pdf.trainee', 'Trainee'),
      tr('common.trainingShared.manager.complianceReport.pdf.department', 'Department'),
      ...moduleHeaders.map((m) => safe(m.moduleName, m.moduleId)),
    ]],
    body: matrixRows.map((row) => [
      safe(row.traineeName, row.traineeId),
      safe(row.department || '—'),
      ...moduleHeaders.map((m) => statusText(row.modules[m.moduleId])),
    ]),
    // Many modules: continue the columns on further pages, repeating the trainee name.
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${title} · ${i} / ${pages}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  doc.save(`training-compliance-${new Date().toISOString().slice(0, 10)}.pdf`);
}
