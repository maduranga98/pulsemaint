import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Timestamp } from 'firebase/firestore';
import type { WorkOrder } from '@/types/workOrder';
import type { Breakdown } from '@/types/breakdown';
import { useAuthStore } from '@/store/authStore';
import { fetchImageAsDataUrl, imageFormatFromDataUrl, resolveCompanyLogoDataUrl } from '@/lib/pdf/logoUtils';
import {
  BREAKDOWN_SEVERITY_LABELS,
  BREAKDOWN_SOURCE_LABELS,
  BREAKDOWN_STATUS_LABELS,
  BREAKDOWN_TYPE_LABELS,
  ROOT_CAUSE_LABELS,
  USER_ROLE_LABELS,
} from '@/constants/copy';
import { registerUnicodeFont } from './pdfFonts';

// Full-detail PDF of a single signed-off work order or closed breakdown, for
// the plant manager's Maintenance History. Same letterhead / table theme as
// handoverPdf.ts and genericReportPdf.ts so it reads like every other
// FirmiCore export.

const HEADER_FILL: [number, number, number] = [10, 22, 40];
const LABEL_FILL: [number, number, number] = [240, 243, 247];
const MARGIN = 40;
const MAX_PHOTOS = 6;

type Row = [string, string];

const WO_TYPE_LABELS: Record<string, string> = {
  BREAKDOWN: 'Breakdown Repair',
  CORRECTIVE: 'Corrective',
  PREVENTIVE: 'Preventive Maintenance',
  INSTALLATION: 'Installation',
  MODIFICATION: 'Modification',
  INSPECTION: 'Inspection',
  CONTRACTOR: 'Contractor',
  OTHER: 'Other',
};
const WO_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD_PARTS: 'On Hold - Parts',
  ON_HOLD_APPROVAL: 'On Hold - Approval',
  COMPLETED: 'Completed',
  SIGNED_OFF: 'Signed Off',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
const OUTCOME_LABELS: Record<string, string> = {
  complete: 'Complete',
  not_complete: 'Not complete',
  failed: 'Failed',
};
const MACHINE_AFTER_LABELS: Record<string, string> = {
  operational: 'Operational',
  partially_operational: 'Partially operational',
  still_down: 'Still down',
};

function toDate(ts: Timestamp | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return typeof ts.toDate === 'function' ? ts.toDate() : null;
}

export function fmtDateTime(ts: Timestamp | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return '-';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMinutes(mins: number | null | undefined): string {
  if (mins == null || !Number.isFinite(mins)) return '-';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function minutesBetween(a: Timestamp | null | undefined, b: Timestamp | null | undefined): number | null {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  return Math.max(0, (db.getTime() - da.getTime()) / 60000);
}

function money(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '-' : n.toFixed(2);
}

function txt(v: unknown): string {
  if (v == null) return '-';
  if (Array.isArray(v)) return v.filter(Boolean).length ? v.filter(Boolean).join(', ') : '-';
  const s = String(v).trim();
  return s || '-';
}

function label(map: Record<string, string>, v: string | null | undefined): string {
  if (!v) return '-';
  return map[v] ?? v.replace(/_/g, ' ');
}

/** Small drawing helper that tracks the cursor and page breaks. */
class Doc {
  doc: jsPDF;
  font = 'helvetica';
  y = 0;
  readonly pageWidth: number;
  readonly pageHeight: number;

  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  get contentWidth() {
    return this.pageWidth - MARGIN * 2;
  }

  ensure(space: number) {
    if (this.y + space > this.pageHeight - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  async header(title: string, subtitle: string) {
    const doc = this.doc;
    this.font = await registerUnicodeFont(doc);
    const company = useAuthStore.getState().company;
    const logoSize = 26;
    const logoY = 24;
    let nameX = MARGIN;
    const logo = await resolveCompanyLogoDataUrl(company);
    if (logo) {
      try {
        doc.addImage(logo, imageFormatFromDataUrl(logo), MARGIN, logoY, logoSize, logoSize);
        nameX = MARGIN + logoSize + 8;
      } catch {
        // Unsupported logo data — skip it rather than fail the export.
      }
    }
    if (company?.name) {
      doc.setFontSize(12);
      doc.setTextColor(10, 22, 40);
      doc.text(company.name, nameX, logoY + logoSize / 2 + 4);
      doc.setTextColor(0);
    }
    const ruleY = logoY + logoSize + 10;
    doc.setDrawColor(10, 22, 40);
    doc.line(MARGIN, ruleY, this.pageWidth - MARGIN, ruleY);

    const titleY = ruleY + 24;
    doc.setFontSize(16);
    doc.text(title, MARGIN, titleY);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, MARGIN, titleY + 18);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, MARGIN, titleY + 32);
    doc.setTextColor(0);
    this.y = titleY + 50;
  }

  section(title: string) {
    this.ensure(40);
    this.doc.setFontSize(12);
    this.doc.setFont(this.font, 'bold');
    this.doc.setTextColor(10, 22, 40);
    this.doc.text(title, MARGIN, this.y);
    this.doc.setFont(this.font, 'normal');
    this.doc.setTextColor(0);
    this.y += 8;
  }

  /** Two-column label/value table. Rows with an empty value ('-') are kept so the report is complete. */
  keyValues(rows: Row[]) {
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: MARGIN, right: MARGIN },
      body: rows,
      theme: 'grid',
      styles: { font: this.font, fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      columnStyles: {
        0: { cellWidth: 150, fillColor: LABEL_FILL, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
    });
    this.y = this.lastY() + 18;
  }

  table(head: string[], body: string[][], emptyText = 'None recorded') {
    if (body.length === 0) {
      this.paragraph(emptyText, true);
      return;
    }
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: MARGIN, right: MARGIN },
      head: [head],
      body,
      theme: 'grid',
      styles: { font: this.font, fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: HEADER_FILL, textColor: 255, font: this.font, fontStyle: 'bold' },
    });
    this.y = this.lastY() + 18;
  }

  paragraph(text: string, muted = false) {
    const lines = this.doc.splitTextToSize(text || '-', this.contentWidth) as string[];
    this.doc.setFontSize(9.5);
    if (muted) this.doc.setTextColor(120);
    lines.forEach((line) => {
      this.ensure(14);
      this.y += 12;
      this.doc.text(line, MARGIN, this.y);
    });
    this.doc.setTextColor(0);
    this.y += 24;
  }

  async photos(title: string, urls: string[]) {
    const list = urls.filter(Boolean).slice(0, MAX_PHOTOS);
    if (list.length === 0) return;
    this.section(title);
    const size = (this.contentWidth - 20) / 3;
    let col = 0;
    this.y += 4;
    for (const url of list) {
      const data = await fetchImageAsDataUrl(url);
      if (!data || !data.startsWith('data:image/')) continue;
      if (col === 0) this.ensure(size + 10);
      try {
        this.doc.addImage(data, imageFormatFromDataUrl(data), MARGIN + col * (size + 10), this.y, size, size);
      } catch {
        continue;
      }
      col += 1;
      if (col === 3) {
        col = 0;
        this.y += size + 10;
      }
    }
    if (col !== 0) this.y += size + 10;
    if (urls.length > MAX_PHOTOS) this.paragraph(`+${urls.length - MAX_PHOTOS} more photo(s) in FirmiCore`, true);
    this.y += 6;
  }

  lastY(): number {
    return (this.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? this.y;
  }

  footer() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(140);
      this.doc.text(`Page ${i} of ${total}`, this.pageWidth - MARGIN, this.pageHeight - 20, { align: 'right' });
      this.doc.setTextColor(0);
    }
  }

  save(filename: string) {
    this.footer();
    this.doc.save(filename.replace(/[^\w.-]+/g, '_'));
  }
}

// ---------------------------------------------------------------------------
// Work order
// ---------------------------------------------------------------------------

export async function exportWorkOrderPdf(wo: WorkOrder): Promise<void> {
  const d = new Doc();
  await d.header(
    `Work Order Report - ${wo.woNumber}`,
    `${label(WO_TYPE_LABELS, wo.woType)}   ·   ${label(WO_STATUS_LABELS, wo.status)}   ·   ${txt(wo.machineName)}`,
  );

  d.section('Summary');
  d.keyValues([
    ['WO number', txt(wo.woNumber)],
    ['Type', label(WO_TYPE_LABELS, wo.woType)],
    ['Priority', label(BREAKDOWN_SEVERITY_LABELS, wo.priority)],
    ['Status', label(WO_STATUS_LABELS, wo.status)],
    ['Machine', txt(wo.machineName)],
    ['Department', txt(wo.machineDepartment)],
    ['Location', txt(wo.machineLocation)],
    ['Machine type / criticality', `${txt(wo.machineType)} / ${txt(wo.machineCriticality)}`],
    ['Linked breakdown(s)', txt(wo.linkedBreakdownTicketNumber ?? (wo.linkedBreakdownIds?.length ? `${wo.linkedBreakdownIds.length} ticket(s)` : null))],
    ['Follow-up of', txt(wo.followUpOfWoNumber)],
    ['Follow-up raised', txt(wo.followUpWoNumber)],
    ['Created', [wo.createdByName, fmtDateTime(wo.createdAt)].filter((v) => v && v !== '-').join(' · ') || '-'],
    ['Due date', fmtDateTime(wo.dueDate)],
    ['SLA deadline', `${fmtDateTime(wo.slaDeadline)}${wo.slaBreached ? ' (breached)' : ''}`],
    ['Estimated duration', wo.estimatedDuration ? `${wo.estimatedDuration} ${wo.estimatedDurationUnit ?? ''}`.trim() : '-'],
    ['Permit-to-work', wo.requiresWorkPermit ? `Required${wo.ptwCategory ? ` (${wo.ptwCategory})` : ''}` : txt(wo.ptwCategory)],
    ['Special tools', txt(wo.specialToolsRequired)],
  ]);

  d.section('Description');
  d.paragraph(txt(wo.description));

  d.section('Team');
  d.keyValues([
    ['Supervisor in charge', txt(wo.supervisorInChargeName)],
    ['Assigned technicians', txt(wo.assignedTechnicianNames)],
    ['Contractor', txt(wo.contractorCompanyName)],
    ['Contractor contact', [wo.contractorContactPerson, wo.contractorContactNumber].filter(Boolean).join(' · ') || '-'],
    ['Contractor technicians', txt(wo.contractorTechnicianNames)],
  ]);

  d.section('Execution');
  d.keyValues([
    ['Checked in', wo.checkedInAt ? `${fmtDateTime(wo.checkedInAt)} by ${txt(wo.checkedInByName)}` : '-'],
    ['Actual start', fmtDateTime(wo.actualStartTime)],
    ['Actual end', fmtDateTime(wo.actualEndTime)],
    ['Total duration', fmtMinutes(wo.totalDurationMinutes ?? minutesBetween(wo.actualStartTime, wo.actualEndTime))],
    ['Machine status after repair', label(MACHINE_AFTER_LABELS, wo.machineStatusAfterRepair)],
    ['Test run', `${txt(wo.testRunResult)}${wo.testRunNotes ? ` - ${wo.testRunNotes}` : ''}`],
  ]);

  d.section('Work done & root cause');
  d.keyValues([
    ['Work done', txt(wo.workDoneDescription)],
    ['Root cause', label(ROOT_CAUSE_LABELS, wo.rootCause)],
    ['Root cause details', txt(wo.rootCauseDescription)],
  ]);

  d.section('Task checklist');
  d.table(
    ['#', 'Step', 'Assigned', 'Completed by', 'Result / value', 'Notes'],
    (wo.checklist ?? []).map((c) => [
      String(c.stepNumber),
      txt(c.stepDescription),
      txt(c.assignedTechnicianNames?.length ? c.assignedTechnicianNames : c.assignedTechnicianName),
      c.isCompleted ? `${txt(c.completedByName)}\n${fmtDateTime(c.completedAt)}` : 'Not completed',
      [c.result ? c.result.toUpperCase() : '', c.actualValue != null ? `${c.actualValue}${c.unit ? ` ${c.unit}` : ''}` : '']
        .filter(Boolean).join(' · ') || '-',
      txt([c.completionNote, c.repairNote].filter(Boolean).join(' / ')),
    ]),
  );

  if (wo.assigneeCompletions?.length) {
    d.section('Individual completions');
    d.table(
      ['Person', 'Hours', 'Work done', 'Steps completed', 'Completed at'],
      wo.assigneeCompletions.map((a) => [
        `${a.technicianName}${a.technicianRole ? ` (${label(USER_ROLE_LABELS, a.technicianRole)})` : ''}`,
        txt(a.hoursWorked),
        txt(a.workDoneDescription),
        txt(a.completedStepsDescription),
        fmtDateTime(a.completedAt),
      ]),
    );
  }

  d.section('Technician work logs');
  d.table(
    ['Person', 'Hours', 'Tasks'],
    (wo.technicianWorkLogs ?? []).map((l) => [
      `${l.technicianName}${l.technicianRole ? ` (${label(USER_ROLE_LABELS, l.technicianRole)})` : ''}`,
      txt(l.hoursWorked),
      txt(l.tasksDescription),
    ]),
  );

  d.section('Parts used');
  const parts = wo.partsUsed ?? [];
  d.table(
    ['Part', 'Qty', 'Source', 'Unit cost', 'Total', 'Warranty'],
    parts.map((p) => [
      txt(p.partName),
      `${txt(p.quantity)} ${p.unit ?? ''}`.trim(),
      txt(p.source),
      money(p.unitCost),
      money(p.totalCost),
      p.warrantyMonths ? `${p.warrantyMonths} mo` : '-',
    ]),
  );
  const partsTotal = parts.reduce((s, p) => s + (Number(p.totalCost) || 0), 0);
  d.keyValues([
    ['Parts cost', money(wo.totalPartsCost ?? partsTotal)],
    ['Project / contractor cost', money(wo.projectCost)],
    ['Total cost', money(wo.totalProjectCost ?? (wo.totalPartsCost ?? partsTotal) + (wo.projectCost ?? 0))],
  ]);

  if (wo.partsRequests?.length) {
    d.section('Parts requests');
    d.table(
      ['Part', 'Qty', 'Requested by', 'Status', 'Note'],
      wo.partsRequests.map((p) => [
        `${txt(p.partName)}${p.partNumber ? ` (${p.partNumber})` : ''}`,
        `${txt(p.quantity)} ${p.unit ?? ''}`.trim(),
        `${txt(p.requestedByName)}\n${fmtDateTime(p.requestedAt)}`,
        txt(p.status),
        txt(p.rejectedReason ?? p.note),
      ]),
    );
  }

  if (wo.approvalRequests?.length) {
    d.section('Approval requests');
    d.table(
      ['Requested by', 'Note', 'Status', 'Resolved by', 'Resolution'],
      wo.approvalRequests.map((a) => [
        `${txt(a.technicianName)}\n${fmtDateTime(a.requestedAt)}`,
        txt(a.note),
        txt(a.status),
        a.resolvedByName ? `${a.resolvedByName}\n${fmtDateTime(a.resolvedAt)}` : '-',
        txt(a.resolutionNote),
      ]),
    );
  }

  d.section('Post-repair checklist');
  d.table(
    ['Step', 'Result', 'Notes'],
    (wo.postRepairChecklist ?? []).map((p) => [
      txt(p.stepDescription),
      p.result ? p.result.toUpperCase() : p.isCompleted ? 'Done' : 'Not done',
      txt(p.notes),
    ]),
  );

  if (wo.contractorHoursLog || wo.contractorRating) {
    d.section('Contractor');
    const rating = wo.contractorRating as unknown as Record<string, unknown> | null | undefined;
    d.keyValues([
      ['Hours on site', txt(wo.contractorHoursLog?.hoursOnSite)],
      ['Hours billed', txt(wo.contractorHoursLog?.hoursBilled)],
      ['Notes', txt(wo.contractorHoursLog?.notes)],
      ...(rating
        ? Object.entries(rating)
            .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
            .map(([k, v]) => [`Rating - ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`, txt(v)] as Row)
        : []),
    ]);
  }

  d.section('Sign-off');
  d.keyValues([
    ['Signed off by', txt(wo.supervisorSignOffByName)],
    ['Signed off at', fmtDateTime(wo.supervisorSignOffAt)],
    ['Outcome', label(OUTCOME_LABELS, wo.signOffOutcome)],
    ['Outcome reason', txt(wo.signOffOutcomeReason)],
    ['Sign-off notes', txt(wo.supervisorSignOffNotes)],
    ['Closed', wo.closedAt ? `${fmtDateTime(wo.closedAt)}${wo.closedByName ? ` by ${wo.closedByName}` : ''}` : '-'],
  ]);

  if (wo.aiRca && wo.aiRca.source === 'ai') {
    d.section('AI root-cause analysis');
    d.keyValues([
      ['Summary', txt(wo.aiRca.summary)],
      ['Root cause', txt(wo.aiRca.rootCause)],
      ['Category', label(ROOT_CAUSE_LABELS, wo.aiRca.rootCauseCategory)],
      ['Contributing factors', txt(wo.aiRca.contributingFactors)],
      ['Evidence', txt(wo.aiRca.evidence)],
      ['Preventive actions', txt(wo.aiRca.preventiveActions)],
      ['Confidence', txt(wo.aiRca.confidence)],
    ]);
  }

  d.section('Status history');
  d.table(
    ['When', 'Status', 'By', 'Note'],
    (wo.statusHistory ?? []).map((h) => [
      fmtDateTime(h.changedAt),
      label(WO_STATUS_LABELS, h.status),
      txt(h.changedByName),
      txt(h.note),
    ]),
  );

  if (wo.documents?.length) {
    d.section('Documents');
    d.table(
      ['Name', 'Uploaded by', 'Uploaded at'],
      wo.documents.map((doc) => [txt(doc.name), txt(doc.uploadedByName), fmtDateTime(doc.uploadedAt)]),
    );
  }

  await d.photos('Completion photos', wo.finalPhotos ?? []);

  d.save(`${wo.woNumber || 'work-order'}.pdf`);
}

// ---------------------------------------------------------------------------
// Breakdown
// ---------------------------------------------------------------------------

export async function exportBreakdownPdf(b: Breakdown, extra?: { linkedWoNumber?: string | null }): Promise<void> {
  const d = new Doc();
  await d.header(
    `Breakdown Report - ${b.ticketNumber}`,
    `${label(BREAKDOWN_STATUS_LABELS, b.status)}   ·   ${txt(b.machineName)}   ·   ${txt(b.machineDepartment)}`,
  );

  const downtime = minutesBetween(b.reportedAt, b.closedAt ?? b.resolvedAt);

  d.section('Summary');
  d.keyValues([
    ['Ticket number', txt(b.ticketNumber)],
    ['Status', label(BREAKDOWN_STATUS_LABELS, b.status)],
    ['Machine', txt(b.machineName)],
    ['Department', txt(b.machineDepartment)],
    ['Location', txt(b.machineLocation)],
    ['Machine criticality', txt(b.machineCriticality)],
    ['Severity', label(BREAKDOWN_SEVERITY_LABELS, b.severity)],
    ['Type', label(BREAKDOWN_TYPE_LABELS, b.type)],
    ['Source', label(BREAKDOWN_SOURCE_LABELS, b.source)],
    ['Reported', `${fmtDateTime(b.reportedAt)}${b.reporterName ? ` by ${b.reporterName}` : ''}`],
    ['Machine still running', b.machineStillRunning ? 'Yes' : 'No'],
    ['Production impact', txt(b.productionImpact)],
    ['Production hours lost', txt(b.productionHoursLost)],
    ['Total downtime', fmtMinutes(downtime)],
    ['SLA deadline', `${fmtDateTime(b.slaDeadline)}${b.slaBreached ? ' (breached)' : ''}`],
    ['Recurring', b.isRecurringFlag ? 'Yes' : 'No'],
    ['Linked work order', txt(extra?.linkedWoNumber ?? (b.linkedWOId ? b.linkedWOId : null))],
  ]);

  d.section('Problem');
  d.keyValues([
    ['Description', txt(b.description)],
    ['Attempted fixes', txt(b.attemptedFixes)],
    ['Technician findings', txt(b.technicianFindings)],
  ]);

  d.section('Assignment');
  d.keyValues([
    ['Assigned technicians', txt(b.assignedTechnicianNames)],
    ['Assigned by', b.assignedByName ? `${b.assignedByName} · ${fmtDateTime(b.assignedAt)}` : '-'],
    ['Attended by', b.attendedByName ? `${b.attendedByName} · ${fmtDateTime(b.attendedAt)}` : '-'],
    ['Contractor assigned', b.assignedContractorId ? 'Yes' : 'No'],
  ]);

  d.section('Timeline');
  d.keyValues([
    ['Reported', fmtDateTime(b.reportedAt)],
    ['Acknowledged', fmtDateTime(b.acknowledgedAt)],
    ['Assigned', fmtDateTime(b.assignedAt)],
    ['En route', fmtDateTime(b.enRouteAt)],
    ['Repair started', fmtDateTime(b.repairStartedAt)],
    ['Resolved', fmtDateTime(b.resolvedAt)],
    ['Closed', fmtDateTime(b.closedAt)],
  ]);

  d.section('Resolution');
  d.keyValues([
    ['Root cause', label(ROOT_CAUSE_LABELS, b.rootCause)],
    ['Root cause details', txt(b.rootCauseDescription)],
    ['Corrective actions', txt(b.correctiveActions)],
    ['Preventive recommendations', txt(b.preventiveRecommendations)],
  ]);

  d.section('Status history');
  d.table(
    ['When', 'Status', 'By', 'Note'],
    (b.statusHistory ?? []).map((h) => [
      fmtDateTime(h.changedAt),
      label(BREAKDOWN_STATUS_LABELS, h.status),
      txt(h.changedByName),
      txt(h.note),
    ]),
  );

  await d.photos('Reported photos', b.photos ?? []);
  await d.photos('Resolution photos', b.resolutionPhotos ?? []);

  d.save(`${b.ticketNumber || 'breakdown'}.pdf`);
}
