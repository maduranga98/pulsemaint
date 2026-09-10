import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TFunction } from 'i18next';
import { registerUnicodeFont, pdfSafeText } from '../../../utils/reports/pdf/pdfFonts';
import { getRoleLabel, type EvaluationSession } from '../types/evaluation.types';

function scoreDisplay(score: number | null, tr: (key: string, fallback: string, vars?: Record<string, unknown>) => string): string {
  return score ? tr('common.evaluation.pdf.scoreDisplay', '{{score}} / 5', { score }) : '';
}

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function addFooters(doc: jsPDF, reportTitle: string, tr: (key: string, fallback: string, vars?: Record<string, unknown>) => string): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, PAGE_HEIGHT - 40, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 40);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(reportTitle, MARGIN_X, PAGE_HEIGHT - 26);
    doc.text(tr('common.evaluation.pdf.footer.generated', 'Generated {{date}}', { date: new Date().toLocaleDateString() }), PAGE_WIDTH / 2, PAGE_HEIGHT - 26, { align: 'center' });
    doc.text(tr('common.evaluation.pdf.footer.page', 'Page {{page}} of {{total}}', { page: i, total: pageCount }), PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 26, { align: 'right' });
  }
}

function drawSectionHeading(doc: jsPDF, text: string, y: number, fontName: string): number {
  doc.setFontSize(11);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(text.toUpperCase(), MARGIN_X, y);
  doc.setFont(fontName, 'normal');
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.line(MARGIN_X, y + 5, MARGIN_X + 28, y + 5);
  return y + 20;
}

/**
 * Builds a full evaluation report PDF entirely on the client. Returns the
 * jsPDF instance so callers can either download it or extract a Blob.
 * Pass `t` (from `useTranslation()`) to translate the report chrome and
 * label lookups; omit it for non-component callers, which falls back to
 * English throughout.
 */
export async function buildEvaluationPdf(session: EvaluationSession, t?: TFunction): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const fontName = await registerUnicodeFont(doc);
  let y = 0;

  // `{{var}}`-style placeholders are always filled in by hand here — never
  // handed to i18next as translation options. i18next treats a `count`
  // option as a plural-form selector, which silently breaks defaultValue
  // interpolation for a key without plural suffixes; substituting the vars
  // ourselves, on both the translated string and the fallback, sidesteps
  // that entirely and guarantees the placeholder is filled either way.
  // `pdfSafeText` then falls back to the (now also interpolated) English
  // text if the translation contains glyphs the embedded PDF font can't
  // render. Mirrors the `tr` helper in src/modules/audit/utils/auditPdf.ts.
  const interpolate = (template: string, vars?: Record<string, unknown>): string =>
    vars ? template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(vars[key] ?? '')) : template;
  const tr = (key: string, fallback: string, vars?: Record<string, unknown>): string => {
    const translated = t ? t(key, { defaultValue: fallback }) : fallback;
    return pdfSafeText(interpolate(translated, vars), interpolate(fallback, vars));
  };

  const isDepartment = (session.targetType ?? 'individual') === 'department';
  const roleLabel = session.evaluateeRole === 'other' && session.evaluateeCustomRole
    ? session.evaluateeCustomRole
    : getRoleLabel(session.evaluateeRole, t);
  const title = isDepartment
    ? tr('common.evaluation.pdf.titleForDepartment', '{{department}} Department — Performance Evaluation Report', { department: session.evaluateeName })
    : tr('common.evaluation.pdf.titleForRole', '{{role}} Performance Evaluation Report', { role: roleLabel });

  // ── Banner header ──────────────────────────────────────────────────────
  const bannerHeight = 74;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_WIDTH, bannerHeight, 'F');
  doc.setFontSize(16);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN_X, 34, { maxWidth: CONTENT_WIDTH });
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  const subtitle = isDepartment
    ? tr('common.evaluation.pdf.subtitleDepartment', 'Department: {{department}}', { department: session.evaluateeName })
    : session.evaluateeJobTitle
      ? tr('common.evaluation.pdf.subtitleIndividualWithJob', '{{name}} · {{role}} · {{jobTitle}}', {
          name: session.evaluateeName, role: roleLabel, jobTitle: session.evaluateeJobTitle,
        })
      : tr('common.evaluation.pdf.subtitleIndividual', '{{name}} · {{role}}', { name: session.evaluateeName, role: roleLabel });
  doc.text(subtitle, MARGIN_X, 54);

  // Overall score badge, right-aligned in the banner.
  doc.setFontSize(20);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${session.overallScore}%`, PAGE_WIDTH - MARGIN_X, 40, { align: 'right' });
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 197, 253);
  doc.text(tr('common.evaluation.pdf.overallScoreBadge', 'OVERALL SCORE'), PAGE_WIDTH - MARGIN_X, 52, { align: 'right' });

  y = bannerHeight + 30;

  // ── Summary details grid ───────────────────────────────────────────────
  y = drawSectionHeading(doc, tr('common.evaluation.pdf.sections.details', 'Evaluation Details'), y, fontName);
  const emptyValue = tr('common.evaluation.pdf.emptyValue', '—');
  const summaryRows: Array<[string, string, string, string]> = [];
  const pairs: Array<[string, string]> = [
    [tr('common.evaluation.pdf.fields.evaluationDate', 'Evaluation Date'), session.evaluationDate],
    [tr('common.evaluation.pdf.fields.status', 'Status'), session.status === 'submitted'
      ? tr('common.evaluation.pdf.status.completed', 'Completed')
      : tr('common.evaluation.pdf.status.ongoingDraft', 'Ongoing (Draft)')],
    [tr('common.evaluation.pdf.fields.evaluator', 'Evaluator'), session.evaluatorName || emptyValue],
    ...(isDepartment ? [] : [[tr('common.evaluation.pdf.fields.employeeId', 'Employee ID'), session.evaluateeEmployeeId || emptyValue] as [string, string]]),
    ...(session.templateName ? [[tr('common.evaluation.pdf.fields.formTemplate', 'Form / Template'), session.templateName] as [string, string]] : []),
  ];
  for (let i = 0; i < pairs.length; i += 2) {
    summaryRows.push([pairs[i][0], pairs[i][1], pairs[i + 1]?.[0] ?? '', pairs[i + 1]?.[1] ?? '']);
  }
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { font: fontName, fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 0, right: 8 } },
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
  y = drawSectionHeading(doc, tr('common.evaluation.pdf.sections.criteriaScores', 'Criteria Scores'), y, fontName);
  autoTable(doc, {
    startY: y,
    head: [[
      tr('common.evaluation.pdf.columns.criterion', 'Criterion'),
      tr('common.evaluation.pdf.columns.score', 'Score'),
      tr('common.evaluation.pdf.columns.comments', 'Comments'),
    ]],
    body: session.criteria.map((c) => [c.label, scoreDisplay(c.score, tr), c.comments || '']),
    styles: { font: fontName, fontSize: 8.5, cellPadding: 5, valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { font: fontName, fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 1: { cellWidth: 50, halign: 'center' } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // ── Comments / development plan ────────────────────────────────────────
  if (session.overallComments) {
    if (y > 700) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, tr('common.evaluation.pdf.sections.overallComments', 'Overall Comments'), y, fontName);
    doc.setFontSize(9);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(session.overallComments, CONTENT_WIDTH);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 12 + 20;
  }

  if (session.developmentPlan) {
    if (y > 700) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, tr('common.evaluation.pdf.sections.developmentPlan', 'Development Plan'), y, fontName);
    doc.setFontSize(9);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(session.developmentPlan, CONTENT_WIDTH);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 12 + 20;
  }

  // ── Post-evaluation actions ────────────────────────────────────────────
  if (session.actionLog.length) {
    if (y > 680) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, tr('common.evaluation.pdf.sections.actionsTaken', 'Actions Taken'), y, fontName);
    autoTable(doc, {
      startY: y,
      head: [[
        tr('common.evaluation.pdf.columns.action', 'Action'),
        tr('common.evaluation.pdf.columns.note', 'Note'),
        tr('common.evaluation.pdf.columns.by', 'By'),
      ]],
      body: session.actionLog.map((a) => [
        a.type === 'training_assigned'
          ? tr('common.evaluation.pdf.actionTypes.trainingAssigned', 'Training Assigned')
          : a.type === 'position_upgraded'
            ? tr('common.evaluation.pdf.actionTypes.positionUpgraded', 'Position Upgraded')
            : tr('common.evaluation.pdf.actionTypes.positionDegraded', 'Position Degraded'),
        a.note,
        a.actorName,
      ]),
      styles: { font: fontName, fontSize: 8.5, cellPadding: 5, valign: 'top', lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { font: fontName, fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  }

  // ── Attachments list ───────────────────────────────────────────────────
  if (session.attachments.length) {
    if (y > 700) { doc.addPage(); y = 60; }
    y = drawSectionHeading(doc, tr('common.evaluation.pdf.sections.attachments', 'Attachments'), y, fontName);
    autoTable(doc, {
      startY: y,
      head: [[tr('common.evaluation.pdf.columns.type', 'Type'), tr('common.evaluation.pdf.columns.file', 'File')]],
      body: session.attachments.map((a) => [a.type, a.name]),
      styles: { font: fontName, fontSize: 8.5, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { font: fontName, fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  addFooters(doc, title, tr);
  return doc;
}

export async function downloadEvaluationPdf(session: EvaluationSession, t?: TFunction): Promise<void> {
  const doc = await buildEvaluationPdf(session, t);
  doc.save(`evaluation-${session.evaluateeName.replace(/\s+/g, '_')}-${session.evaluationDate}.pdf`);
}

/**
 * One-row-per-evaluation summary PDF, for exporting a batch of completed
 * evaluations at once rather than one at a time (see downloadEvaluationPdf).
 */
export async function buildEvaluationsSummaryPdf(sessions: EvaluationSession[], t?: TFunction): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const fontName = await registerUnicodeFont(doc);
  const marginX = 40;
  let y = 48;

  const interpolate = (template: string, vars?: Record<string, unknown>): string =>
    vars ? template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(vars[key] ?? '')) : template;
  const tr = (key: string, fallback: string, vars?: Record<string, unknown>): string => {
    const translated = t ? t(key, { defaultValue: fallback }) : fallback;
    return pdfSafeText(interpolate(translated, vars), interpolate(fallback, vars));
  };

  doc.setFontSize(18);
  doc.setFont(fontName, 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(tr('common.evaluation.pdf.summary.title', 'Performance Evaluations Summary'), marginX, y);

  y += 16;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    tr('common.evaluation.pdf.summary.generated', 'Generated {{date}} · {{count}} evaluation', {
      date: new Date().toLocaleDateString(),
      count: sessions.length,
    }),
    marginX,
    y,
  );
  y += 14;

  autoTable(doc, {
    startY: y,
    head: [[
      tr('common.evaluation.pdf.columns.name', 'Name'),
      tr('common.evaluation.pdf.columns.category', 'Category'),
      tr('common.evaluation.pdf.columns.date', 'Date'),
      tr('common.evaluation.pdf.columns.evaluator', 'Evaluator'),
      tr('common.evaluation.pdf.columns.score2', 'Score'),
    ]],
    body: sessions.map((s) => {
      const isDepartment = (s.targetType ?? 'individual') === 'department';
      const category = isDepartment
        ? tr('common.evaluation.pdf.summary.departmentCategory', 'Department')
        : s.evaluateeRole === 'other' && s.evaluateeCustomRole
          ? s.evaluateeCustomRole
          : getRoleLabel(s.evaluateeRole, t);
      return [s.evaluateeName, category, s.evaluationDate, s.evaluatorName || '', `${s.overallScore}%`];
    }),
    styles: { font: fontName, fontSize: 9, cellPadding: 4, valign: 'top' },
    headStyles: { font: fontName, fillColor: [37, 99, 235] },
    columnStyles: { 4: { cellWidth: 50, halign: 'right' } },
  });

  return doc;
}

export async function downloadEvaluationsSummaryPdf(sessions: EvaluationSession[], t?: TFunction): Promise<void> {
  const doc = await buildEvaluationsSummaryPdf(sessions, t);
  doc.save(`evaluations-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
