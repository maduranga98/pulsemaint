import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TFunction } from 'i18next';
import { registerUnicodeFont, pdfSafeText } from '../../../utils/reports/pdf/pdfFonts';
import {
  getCategoryLabel,
  getFindingKindLabel,
  type AuditSession,
} from '../types/audit.types';

function answerDisplay(value: string, answerType: string, tr: (key: string, fallback: string) => string): string {
  if (answerType === 'yes_no') return value === 'yes' ? tr('common.audit.answers.yes', 'Yes') : value === 'no' ? tr('common.audit.answers.no', 'No') : '';
  if (answerType === 'scale') return value ? `${value} / 5` : '';
  return value || '';
}

/**
 * Builds a full audit report PDF entirely on the client. Returns the jsPDF
 * instance so callers can either download it or extract a Blob for upload.
 * Pass `t` (from `useTranslation()`) to translate the report chrome and
 * label lookups; omit it for non-component callers (e.g. audit.service.ts's
 * auto-upload-on-submit path), which falls back to English throughout.
 */
export async function buildAuditPdf(session: AuditSession, t?: TFunction): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const fontName = await registerUnicodeFont(doc);
  const marginX = 40;
  let y = 48;

  // `{{var}}`-style placeholders are always filled in by hand here — never
  // handed to i18next as translation options. i18next treats a `count`
  // option as a plural-form selector, which silently breaks defaultValue
  // interpolation for a key without plural suffixes; substituting the vars
  // ourselves, on both the translated string and the fallback, sidesteps
  // that entirely and guarantees the placeholder is filled either way.
  // `pdfSafeText` then falls back to the (now also interpolated) English
  // text if the translation contains glyphs the embedded PDF font can't
  // render (e.g. CJK) — see pdfFonts.ts. Mirrors the `tr` helper in
  // src/utils/reports/pdf/genericReportPdf.ts.
  const interpolate = (template: string, vars?: Record<string, unknown>): string =>
    vars ? template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(vars[key] ?? '')) : template;
  const tr = (key: string, fallback: string, vars?: Record<string, unknown>): string => {
    const translated = t ? t(key, { defaultValue: fallback }) : fallback;
    return pdfSafeText(interpolate(translated, vars), interpolate(fallback, vars));
  };

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(
    tr('common.audit.pdf.reportTitle', '{{category}} Report', {
      category: getCategoryLabel(session.category, session.templateName, t),
    }),
    marginX,
    y,
  );

  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(tr('common.audit.pdf.template', 'Template: {{name}}', { name: session.templateName }), marginX, y);
  y += 14;
  doc.text(
    tr('common.audit.pdf.dateScoreSummary', 'Date: {{date}}    Score: {{score}}%    ({{passed}}/{{total}} passed)', {
      date: session.auditDate,
      score: session.score,
      passed: session.passedTasks,
      total: session.totalTasks,
    }),
    marginX,
    y,
  );

  // ── Header / scope table ──────────────────────────────────────────────
  y += 14;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { font: fontName, fontSize: 9, cellPadding: 2 },
    body: [
      [
        tr('common.audit.pdf.conductedBy', 'Conducted by'),
        `${session.auditorName} (${session.auditorRole}${session.auditorEmployeeId ? ', #' + session.auditorEmployeeId : ''})`,
      ],
      [tr('common.audit.pdf.department', 'Department'), session.department || ''],
      [tr('common.audit.pdf.locationZone', 'Location / Zone'), session.location || ''],
      session.category === 'contractor'
        ? [tr('common.audit.pdf.contractors', 'Contractors'), (session.contractors ?? []).map((c) => c.name).join(', ') || '']
        : [tr('common.audit.pdf.machines', 'Machines'), session.machines.map((m) => m.name).join(', ') || ''],
      [tr('common.audit.pdf.participants', 'Participants'), session.participants.map((p) => `${p.name} (${p.role})`).join(', ') || ''],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: [71, 85, 105] } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Checklist / answers ───────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(tr('common.audit.pdf.checklistResponses', 'Checklist Responses'), marginX, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [[
      tr('common.audit.pdf.columns.number', '#'),
      tr('common.audit.pdf.columns.task', 'Task'),
      tr('common.audit.pdf.columns.answer', 'Answer'),
      tr('common.audit.pdf.columns.result', 'Result'),
      tr('common.audit.pdf.columns.notes', 'Notes'),
    ]],
    body: session.answers.map((a, i) => [
      String(i + 1),
      a.taskText,
      answerDisplay(a.value, a.answerType, tr),
      a.failed ? tr('common.audit.pdf.resultFail', 'FAIL') : tr('common.audit.pdf.resultOk', 'OK'),
      a.notes || '',
    ]),
    styles: { font: fontName, fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { font: fontName, fillColor: [37, 99, 235] },
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 55 }, 3: { cellWidth: 40 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3 && data.cell.raw === tr('common.audit.pdf.resultFail', 'FAIL')) {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Findings (losses/breakdowns/safety/maintenance) ───────────────────
  if (session.findings.length) {
    doc.setFontSize(12);
    doc.text(tr('common.audit.pdf.findingsTitle', 'Findings — Reasons & Solutions'), marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [[
        tr('common.audit.pdf.columns.type', 'Type'),
        tr('common.audit.pdf.columns.description', 'Description'),
        tr('common.audit.pdf.columns.reason', 'Reason'),
        tr('common.audit.pdf.columns.solution', 'Solution'),
      ]],
      body: session.findings.map((f) => [
        getFindingKindLabel(f.kind, t),
        f.description,
        f.reason,
        f.solution,
      ]),
      styles: { font: fontName, fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { font: fontName, fillColor: [217, 119, 6] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // ── AI root-cause suggestions ─────────────────────────────────────────
  if (session.aiSuggestions.length) {
    doc.setFontSize(12);
    doc.text(tr('common.audit.pdf.aiRootCauseTitle', 'AI Root-Cause Analysis'), marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [[
        tr('common.audit.pdf.columns.finding', 'Finding'),
        tr('common.audit.pdf.columns.priority', 'Priority'),
        tr('common.audit.pdf.columns.probableCauses', 'Probable Causes'),
        tr('common.audit.pdf.columns.recommendedActions', 'Recommended Actions'),
      ]],
      body: session.aiSuggestions.map((s) => [
        s.findingDescription,
        s.priority.toUpperCase(),
        s.probableCauses.map((c) => `• ${c}`).join('\n'),
        s.recommendedActions.map((a) => `• ${a}`).join('\n'),
      ]),
      styles: { font: fontName, fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { font: fontName, fillColor: [22, 163, 74] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // ── Attachments list ──────────────────────────────────────────────────
  if (session.attachments.length) {
    if (y > 740) { doc.addPage(); y = 48; }
    doc.setFontSize(12);
    doc.text(tr('common.audit.pdf.attachmentsTitle', 'Attachments'), marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [[tr('common.audit.pdf.columns.type', 'Type'), tr('common.audit.pdf.columns.file', 'File')]],
      body: session.attachments.map((a) => [a.type, a.name]),
      styles: { font: fontName, fontSize: 8, cellPadding: 3 },
      headStyles: { font: fontName, fillColor: [100, 116, 139] },
    });
  }

  return doc;
}

export async function downloadAuditPdf(session: AuditSession, t?: TFunction): Promise<void> {
  const doc = await buildAuditPdf(session, t);
  doc.save(`audit-${session.category}-${session.auditDate}.pdf`);
}

export async function auditPdfBlob(session: AuditSession, t?: TFunction): Promise<Blob> {
  const doc = await buildAuditPdf(session, t);
  return doc.output('blob');
}
