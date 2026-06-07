import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AUDIT_CATEGORY_LABELS,
  FINDING_KIND_LABELS,
  type AuditSession,
} from '../types/audit.types';

function answerDisplay(value: string, answerType: string): string {
  if (answerType === 'yes_no') return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '—';
  if (answerType === 'scale') return value ? `${value} / 5` : '—';
  return value || '—';
}

/**
 * Builds a full audit report PDF entirely on the client. Returns the jsPDF
 * instance so callers can either download it or extract a Blob for upload.
 */
export function buildAuditPdf(session: AuditSession): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 48;

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${AUDIT_CATEGORY_LABELS[session.category]} Report`, marginX, y);

  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Template: ${session.templateName}`, marginX, y);
  y += 14;
  doc.text(`Date: ${session.auditDate}    Score: ${session.score}%    (${session.passedTasks}/${session.totalTasks} passed)`, marginX, y);

  // ── Header / scope table ──────────────────────────────────────────────
  y += 14;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    body: [
      ['Conducted by', `${session.auditorName} (${session.auditorRole}${session.auditorEmployeeId ? ', #' + session.auditorEmployeeId : ''})`],
      ['Department', session.department || '—'],
      ['Location / Zone', session.location || '—'],
      ['Machines', session.machines.map((m) => m.name).join(', ') || '—'],
      ['Participants', session.participants.map((p) => `${p.name} (${p.role})`).join(', ') || '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: [71, 85, 105] } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Checklist / answers ───────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Checklist Responses', marginX, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['#', 'Task', 'Answer', 'Result', 'Notes']],
    body: session.answers.map((a, i) => [
      String(i + 1),
      a.taskText,
      answerDisplay(a.value, a.answerType),
      a.failed ? 'FAIL' : 'OK',
      a.notes || '',
    ]),
    styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 55 }, 3: { cellWidth: 40 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3 && data.cell.raw === 'FAIL') {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Findings (losses/breakdowns/safety/maintenance) ───────────────────
  if (session.findings.length) {
    doc.setFontSize(12);
    doc.text('Findings — Reasons & Solutions', marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Description', 'Reason', 'Solution']],
      body: session.findings.map((f) => [
        FINDING_KIND_LABELS[f.kind],
        f.description,
        f.reason,
        f.solution,
      ]),
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { fillColor: [217, 119, 6] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // ── AI root-cause suggestions ─────────────────────────────────────────
  if (session.aiSuggestions.length) {
    doc.setFontSize(12);
    doc.text('AI Root-Cause Analysis', marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Finding', 'Priority', 'Probable Causes', 'Recommended Actions']],
      body: session.aiSuggestions.map((s) => [
        s.findingDescription,
        s.priority.toUpperCase(),
        s.probableCauses.map((c) => `• ${c}`).join('\n'),
        s.recommendedActions.map((a) => `• ${a}`).join('\n'),
      ]),
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      headStyles: { fillColor: [22, 163, 74] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // ── Attachments list ──────────────────────────────────────────────────
  if (session.attachments.length) {
    if (y > 740) { doc.addPage(); y = 48; }
    doc.setFontSize(12);
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

export function downloadAuditPdf(session: AuditSession): void {
  const doc = buildAuditPdf(session);
  doc.save(`audit-${session.category}-${session.auditDate}.pdf`);
}

export function auditPdfBlob(session: AuditSession): Blob {
  return buildAuditPdf(session).output('blob');
}
