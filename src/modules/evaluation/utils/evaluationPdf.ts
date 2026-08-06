import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EVALUATION_ROLE_LABELS, type EvaluationSession } from '../types/evaluation.types';

function scoreDisplay(score: number | null): string {
  return score ? `${score} / 5` : '';
}

/**
 * Builds a full evaluation report PDF entirely on the client. Returns the
 * jsPDF instance so callers can either download it or extract a Blob.
 */
export function buildEvaluationPdf(session: EvaluationSession): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 48;

  const isDepartment = (session.targetType ?? 'individual') === 'department';
  const roleLabel = session.evaluateeRole === 'other' && session.evaluateeCustomRole
    ? session.evaluateeCustomRole
    : EVALUATION_ROLE_LABELS[session.evaluateeRole];

  // Title reflects the specific category being evaluated (role or
  // department) rather than one generic heading reused for every export.
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(
    isDepartment
      ? `${session.evaluateeName} Department — Performance Evaluation Report`
      : `${roleLabel} Performance Evaluation Report`,
    marginX,
    y,
  );

  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  if (isDepartment) {
    doc.text(`Department: ${session.evaluateeName}`, marginX, y);
  } else {
    doc.text(`${session.evaluateeName} · ${roleLabel}${session.evaluateeJobTitle ? ' · ' + session.evaluateeJobTitle : ''}`, marginX, y);
  }
  y += 14;
  doc.text(`Date: ${session.evaluationDate}    Overall Score: ${session.overallScore}%${session.templateName ? `    Form: ${session.templateName}` : ''}`, marginX, y);

  // ── Header table ────────────────────────────────────────────────────────
  y += 14;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ['Evaluator', session.evaluatorName || ''],
      ...(isDepartment ? [] : [['Employee ID', session.evaluateeEmployeeId || '']]),
      ['Status', session.status === 'submitted' ? 'Completed' : 'Ongoing (Draft)'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: [71, 85, 105] } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Criteria scores ────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Criteria Scores', marginX, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Criterion', 'Score', 'Comments']],
    body: session.criteria.map((c) => [c.label, scoreDisplay(c.score), c.comments || '']),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 1: { cellWidth: 45 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Comments / development plan ────────────────────────────────────────
  if (session.overallComments) {
    doc.setFontSize(12);
    doc.text('Overall Comments', marginX, y);
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(session.overallComments, 515);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 14;
  }

  if (session.developmentPlan) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Development Plan', marginX, y);
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(session.developmentPlan, 515);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 14;
  }

  // ── Post-evaluation actions ────────────────────────────────────────────
  if (session.actionLog.length) {
    if (y > 700) { doc.addPage(); y = 48; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Actions Taken', marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Action', 'Note', 'By']],
      body: session.actionLog.map((a) => [
        a.type === 'training_assigned' ? 'Training Assigned' : a.type === 'position_upgraded' ? 'Position Upgraded' : 'Position Degraded',
        a.note,
        a.actorName,
      ]),
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { fillColor: [22, 163, 74] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // ── Attachments list ───────────────────────────────────────────────────
  if (session.attachments.length) {
    if (y > 740) { doc.addPage(); y = 48; }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Attachments', marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Type', 'File']],
      body: session.attachments.map((a) => [a.type, a.name]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [100, 116, 139] },
    });
  }

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
