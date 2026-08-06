import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EVALUATION_ROLE_LABELS, type EvaluationSession } from '../types/evaluation.types';

function scoreDisplay(score: number | null): string {
  return score ? `${score} / 5` : '';
}

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function addFooters(doc: jsPDF, reportTitle: string): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, PAGE_HEIGHT - 40, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 40);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(reportTitle, MARGIN_X, PAGE_HEIGHT - 26);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 26, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 26, { align: 'right' });
  }
}

function drawSectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(text.toUpperCase(), MARGIN_X, y);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.line(MARGIN_X, y + 5, MARGIN_X + 28, y + 5);
  return y + 20;
}

/**
 * Builds a full evaluation report PDF entirely on the client. Returns the
 * jsPDF instance so callers can either download it or extract a Blob.
 */
export function buildEvaluationPdf(session: EvaluationSession): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 0;

  const isDepartment = (session.targetType ?? 'individual') === 'department';
  const roleLabel = session.evaluateeRole === 'other' && session.evaluateeCustomRole
    ? session.evaluateeCustomRole
    : EVALUATION_ROLE_LABELS[session.evaluateeRole];
  const title = isDepartment
    ? `${session.evaluateeName} Department — Performance Evaluation Report`
    : `${roleLabel} Performance Evaluation Report`;

  // ── Banner header ──────────────────────────────────────────────────────
  const bannerHeight = 74;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_WIDTH, bannerHeight, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN_X, 34, { maxWidth: CONTENT_WIDTH });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  const subtitle = isDepartment
    ? `Department: ${session.evaluateeName}`
    : `${session.evaluateeName} · ${roleLabel}${session.evaluateeJobTitle ? ' · ' + session.evaluateeJobTitle : ''}`;
  doc.text(subtitle, MARGIN_X, 54);

  // Overall score badge, right-aligned in the banner.
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${session.overallScore}%`, PAGE_WIDTH - MARGIN_X, 40, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 197, 253);
  doc.text('OVERALL SCORE', PAGE_WIDTH - MARGIN_X, 52, { align: 'right' });

  y = bannerHeight + 30;

  // ── Summary details grid ───────────────────────────────────────────────
  y = drawSectionHeading(doc, 'Evaluation Details', y);
  const summaryRows: Array<[string, string, string, string]> = [];
  const pairs: Array<[string, string]> = [
    ['Evaluation Date', session.evaluationDate],
    ['Status', session.status === 'submitted' ? 'Completed' : 'Ongoing (Draft)'],
    ['Evaluator', session.evaluatorName || '—'],
    ...(isDepartment ? [] : [['Employee ID', session.evaluateeEmployeeId || '—'] as [string, string]]),
    ...(session.templateName ? [['Form / Template', session.templateName] as [string, string]] : []),
  ];
  for (let i = 0; i < pairs.length; i += 2) {
    summaryRows.push([pairs[i][0], pairs[i][1], pairs[i + 1]?.[0] ?? '', pairs[i + 1]?.[1] ?? '']);
  }
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 0, right: 8 } },
    body: summaryRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100, textColor: [71, 85, 105] },
      1: { cellWidth: 175, textColor: [15, 23, 42] },
      2: { fontStyle: 'bold', cellWidth: 100, textColor: [71, 85, 105] },
      3: { cellWidth: 140, textColor: [15, 23, 42] },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;

  // ── Criteria scores ────────────────────────────────────────────────────
  y = drawSectionHeading(doc, 'Criteria Scores', y);
  autoTable(doc, {
    startY: y,
    head: [['Criterion', 'Score', 'Comments']],
    body: session.criteria.map((c) => [c.label, scoreDisplay(c.score), c.comments || '']),
    styles: { fontSize: 8.5, cellPadding: 5, valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 1: { cellWidth: 50, halign: 'center' } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // ── Comments / development plan ────────────────────────────────────────
  if (session.overallComments) {
    if (y > 700) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, 'Overall Comments', y);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(session.overallComments, CONTENT_WIDTH);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 12 + 20;
  }

  if (session.developmentPlan) {
    if (y > 700) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, 'Development Plan', y);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(session.developmentPlan, CONTENT_WIDTH);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 12 + 20;
  }

  // ── Post-evaluation actions ────────────────────────────────────────────
  if (session.actionLog.length) {
    if (y > 680) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, 'Actions Taken', y);
    autoTable(doc, {
      startY: y,
      head: [['Action', 'Note', 'By']],
      body: session.actionLog.map((a) => [
        a.type === 'training_assigned' ? 'Training Assigned' : a.type === 'position_upgraded' ? 'Position Upgraded' : 'Position Degraded',
        a.note,
        a.actorName,
      ]),
      styles: { fontSize: 8.5, cellPadding: 5, valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  }

  // ── Attachments list ───────────────────────────────────────────────────
  if (session.attachments.length) {
    if (y > 700) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, 'Attachments', y);
    autoTable(doc, {
      startY: y,
      head: [['Type', 'File']],
      body: session.attachments.map((a) => [a.type, a.name]),
      styles: { fontSize: 8.5, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  addFooters(doc, title);
  return doc;
}

export function downloadEvaluationPdf(session: EvaluationSession): void {
  const doc = buildEvaluationPdf(session);
  doc.save(`evaluation-${session.evaluateeName.replace(/\s+/g, '_')}-${session.evaluationDate}.pdf`);
}

/**
 * One-row-per-evaluation summary PDF, for exporting a batch of completed
 * evaluations at once rather than one at a time (see downloadEvaluationPdf).
 */
export function buildEvaluationsSummaryPdf(sessions: EvaluationSession[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 48;

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Performance Evaluations Summary', marginX, y);

  y += 16;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${new Date().toLocaleDateString()} · ${sessions.length} evaluation${sessions.length === 1 ? '' : 's'}`, marginX, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [['Name', 'Category', 'Date', 'Evaluator', 'Score']],
    body: sessions.map((s) => {
      const isDepartment = (s.targetType ?? 'individual') === 'department';
      const category = isDepartment
        ? 'Department'
        : s.evaluateeRole === 'other' && s.evaluateeCustomRole
          ? s.evaluateeCustomRole
          : EVALUATION_ROLE_LABELS[s.evaluateeRole];
      return [s.evaluateeName, category, s.evaluationDate, s.evaluatorName || '', `${s.overallScore}%`];
    }),
    styles: { fontSize: 9, cellPadding: 4, valign: 'top' },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 4: { cellWidth: 50, halign: 'right' } },
  });

  return doc;
}

export function downloadEvaluationsSummaryPdf(sessions: EvaluationSession[]): void {
  const doc = buildEvaluationsSummaryPdf(sessions);
  doc.save(`evaluations-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
