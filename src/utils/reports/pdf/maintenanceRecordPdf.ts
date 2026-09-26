import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, limit, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import type { WorkOrder } from '@/types/workOrder';
import type { Breakdown } from '@/types/breakdown';
import type { RCA } from '@/types/rca';
import { WORK_PERMIT_CATEGORIES, type WorkPermit } from '@/types/safety';
import { db } from '@/lib/firebase';
import { listWorkPermitsForWorkOrder } from '@/services/safety.service';
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
// FirmiCore export. Only filled-in fields are printed: empty rows are dropped,
// and a section with nothing in it is left out entirely.

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

/** A value worth printing — not blank and not the '-' placeholder. */
function filled(v: string | null | undefined): v is string {
  return !!v && v.trim() !== '' && v.trim() !== '-';
}

/** Joins only the filled parts; '-' when none are. */
function joinFilled(parts: (string | null | undefined)[], sep = ' · '): string {
  const kept = parts.filter(filled);
  return kept.length ? kept.join(sep) : '-';
}

/** Permit validity strings are 'YYYY-MM-DDTHH:mm' (legacy: 'YYYY-MM-DD'). */
function fmtPermitDate(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v.length === 10 ? `${v}T00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return v.length === 10
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : fmtDateTime(d);
}

function permitCategoryLabel(c: string | null | undefined): string {
  if (!c) return '-';
  return WORK_PERMIT_CATEGORIES.find((x) => x.value === c)?.label ?? c.replace(/_/g, ' ');
}

const PERMIT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  expired: 'Expired',
};
const PERMIT_COMPLETION_LABELS: Record<string, string> = {
  completed: 'Completed',
  partially_completed: 'Partially completed',
  not_completed: 'Not completed',
};

/**
 * Where a permit was raised. New permits record it; for older ones, the
 * WO's own permit created within minutes of the WO counts as "with the WO".
 */
function permitSource(p: WorkPermit, wo: WorkOrder): string {
  if (p.source === 'work_order') return 'Raised with the work order';
  if (p.source === 'manual') return 'Work Permits tab';
  const gap = Math.abs((toDate(p.createdAt)?.getTime() ?? 0) - (toDate(wo.createdAt)?.getTime() ?? 0));
  return p.id === wo.workPermitId && gap < 10 * 60 * 1000 ? 'Raised with the work order' : 'Work Permits tab';
}

async function loadPermits(wo: WorkOrder): Promise<WorkPermit[]> {
  const companyId =
    (wo as unknown as { companyId?: string }).companyId ?? useAuthStore.getState().userProfile?.companyId;
  if (!companyId || !wo.id) return [];
  try {
    return await listWorkPermitsForWorkOrder(companyId, wo.id, wo.workPermitId);
  } catch (err) {
    console.warn('Work permits unavailable for the report', err);
    return [];
  }
}

/** The latest 5-Whys RCA for a WO or breakdown — null if none, or the role can't read `rca`. */
async function loadRca(field: 'linkedWOId' | 'breakdownId', id: string | null | undefined): Promise<RCA | null> {
  if (!id) return null;
  try {
    const snap = await getDocs(
      query(collection(db, 'rca'), where(field, '==', id), orderBy('createdAt', 'desc'), limit(1)),
    );
    return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as RCA);
  } catch {
    return null;
  }
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

  /** Two-column label/value table of the filled rows only. */
  keyValues(rows: Row[]) {
    const body = rows.filter(([, v]) => filled(v));
    if (body.length === 0) return;
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: MARGIN, right: MARGIN },
      body,
      theme: 'grid',
      styles: { font: this.font, fontSize: 9, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      columnStyles: {
        0: { cellWidth: 150, fillColor: LABEL_FILL, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
    });
    this.y = this.lastY() + 18;
  }

  /** A titled label/value section — skipped entirely when no row is filled. */
  kvSection(title: string, rows: Row[]) {
    if (!rows.some(([, v]) => filled(v))) return;
    this.section(title);
    this.keyValues(rows);
  }

  /** A titled table — skipped entirely when there are no rows. */
  tableSection(title: string, head: string[], body: string[][]) {
    if (body.length === 0) return;
    this.section(title);
    this.table(head, body);
  }

  /** A titled paragraph — skipped when the text is empty. */
  textSection(title: string, text: string | null | undefined) {
    if (!filled(text)) return;
    this.section(title);
    this.paragraph(text);
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
      // Blank rather than '-' for a cell with nothing in it.
      body: body.map((row) => row.map((cell) => (filled(cell) ? cell : ''))),
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
  const [permits, rcaDoc] = await Promise.all([loadPermits(wo), loadRca('linkedWOId', wo.id)]);
  const d = new Doc();
  await d.header(
    `Work Order Report - ${wo.woNumber}`,
    joinFilled([label(WO_TYPE_LABELS, wo.woType), label(WO_STATUS_LABELS, wo.status), txt(wo.machineName)], '   ·   '),
  );

  d.kvSection('Summary', [
    ['WO number', txt(wo.woNumber)],
    ['Type', label(WO_TYPE_LABELS, wo.woType)],
    ['Priority', label(BREAKDOWN_SEVERITY_LABELS, wo.priority)],
    ['Status', label(WO_STATUS_LABELS, wo.status)],
    ['Machine', txt(wo.machineName)],
    ['Department', txt(wo.machineDepartment)],
    ['Location', txt(wo.machineLocation)],
    ['Machine type / criticality', joinFilled([txt(wo.machineType), txt(wo.machineCriticality)], ' / ')],
    ['Linked breakdown(s)', txt(wo.linkedBreakdownTicketNumber ?? (wo.linkedBreakdownIds?.length ? `${wo.linkedBreakdownIds.length} ticket(s)` : null))],
    ['Follow-up of', txt(wo.followUpOfWoNumber)],
    ['Follow-up raised', txt(wo.followUpWoNumber)],
    ['Created', joinFilled([wo.createdByName, fmtDateTime(wo.createdAt)])],
    ['Due date', fmtDateTime(wo.dueDate)],
    ['SLA deadline', filled(fmtDateTime(wo.slaDeadline)) ? `${fmtDateTime(wo.slaDeadline)}${wo.slaBreached ? ' (breached)' : ''}` : '-'],
    ['Estimated duration', wo.estimatedDuration ? `${wo.estimatedDuration} ${wo.estimatedDurationUnit ?? ''}`.trim() : '-'],
    ['Permit-to-work', wo.requiresWorkPermit || permits.length
      ? joinFilled([
          'Required',
          wo.ptwCategory ? permitCategoryLabel(wo.ptwCategory) : null,
          permits.length ? `${permits.length} permit(s) - see Work permits` : null,
        ])
      : '-'],
    ['Special tools', txt(wo.specialToolsRequired)],
  ]);

  d.textSection('Description', txt(wo.description));

  d.kvSection('Team', [
    ['Supervisor in charge', txt(wo.supervisorInChargeName)],
    ['Assigned technicians', txt(wo.assignedTechnicianNames)],
    ['Contractor', txt(wo.contractorCompanyName)],
    ['Contractor contact', joinFilled([wo.contractorContactPerson, wo.contractorContactNumber])],
    ['Contractor technicians', txt(wo.contractorTechnicianNames)],
  ]);

  // Every permit raised against this WO — with the WO or from the Work Permits tab.
  permits.forEach((p) => {
    const extensions = p.extensions ?? [];
    d.kvSection(`Work permit ${joinFilled([p.permitNumber, p.title], ' - ')}`, [
      ['Raised from', permitSource(p, wo)],
      ['Category', permitCategoryLabel(p.category)],
      ['Status', label(PERMIT_STATUS_LABELS, p.status)],
      ['Created', joinFilled([p.requestedByName, fmtDateTime(p.createdAt)])],
      ['Supervisor', txt(p.supervisorName)],
      ['Valid from', fmtPermitDate(p.validFrom)],
      ['Valid until (due)', fmtPermitDate(p.validTo)],
      ['Originally due', extensions.length || (p.originalValidTo && p.originalValidTo !== p.validTo) ? fmtPermitDate(p.originalValidTo ?? extensions[0]?.from) : '-'],
      ['Extensions', extensions
        .map((e, i) => `${i + 1}. ${fmtPermitDate(e.from)} -> ${fmtPermitDate(e.to)}${e.byName ? ` by ${e.byName}` : ''}${filled(fmtDateTime(e.at)) ? ` (${fmtDateTime(e.at)})` : ''}`)
        .join('\n')],
      ['Closed', joinFilled([fmtDateTime(p.closedAt ?? p.signedOffAt), p.signedOffByName ? `by ${p.signedOffByName}` : null], ' ')],
      ['Completion', label(PERMIT_COMPLETION_LABELS, p.completion)],
      ['Completion note', txt(p.completionNote)],
      ['Location', txt(p.location)],
      ['Hazards', txt(p.hazards)],
      ['Precautions', (p.precautions ?? []).filter(Boolean).join('\n')],
      ['PPE required', txt(p.ppeRequired)],
    ]);
  });

  d.kvSection('Execution', [
    ['Checked in', wo.checkedInAt ? joinFilled([fmtDateTime(wo.checkedInAt), wo.checkedInByName ? `by ${wo.checkedInByName}` : null], ' ') : '-'],
    ['Actual start', fmtDateTime(wo.actualStartTime)],
    ['Actual end', fmtDateTime(wo.actualEndTime)],
    ['Total duration', fmtMinutes(wo.totalDurationMinutes ?? minutesBetween(wo.actualStartTime, wo.actualEndTime))],
    ['Machine status after repair', label(MACHINE_AFTER_LABELS, wo.machineStatusAfterRepair)],
    ['Test run', joinFilled([txt(wo.testRunResult), wo.testRunNotes], ' - ')],
  ]);

  // Who did the (human) root-cause analysis: the 5-Whys author if there is
  // one, otherwise whoever submitted the completion form that carries it.
  const hasHumanRootCause = (!!wo.rootCause && wo.rootCause !== 'unknown') || filled(wo.rootCauseDescription);
  const completedBy = [...(wo.statusHistory ?? [])].reverse().find((h) => h.status === 'COMPLETED');
  const humanRcaBy = rcaDoc
    ? joinFilled([`Human - ${txt(rcaDoc.createdByName)}`, '5-Whys analysis', fmtDateTime(rcaDoc.createdAt)])
    : hasHumanRootCause
      ? joinFilled([completedBy?.changedByName ? `Human - ${completedBy.changedByName}` : 'Human', 'work order completion', fmtDateTime(completedBy?.changedAt)])
      : '-';

  d.kvSection('Work done & root cause', [
    ['Work done', txt(wo.workDoneDescription)],
    ['Root cause', wo.rootCause === 'unknown' && !filled(wo.rootCauseDescription) ? '-' : label(ROOT_CAUSE_LABELS, wo.rootCause)],
    ['Root cause details', txt(wo.rootCauseDescription)],
    ['RCA performed by', humanRcaBy],
  ]);

  if (rcaDoc) {
    d.tableSection(
      'Root-cause analysis (5-Whys) - by a person',
      ['#', 'Question', 'Answer'],
      (rcaDoc.whys ?? []).filter((w) => filled(w.answer)).map((w, i) => [String(i + 1), txt(w.question), txt(w.answer)]),
    );
    d.keyValues([
      ['Problem', txt(rcaDoc.problem)],
      ['Root cause', txt(rcaDoc.rootCause)],
      ['Corrective action', txt(rcaDoc.correctiveAction)],
      ['Status', txt(rcaDoc.status)],
    ]);
  }

  d.tableSection(
    'Task checklist',
    ['#', 'Step', 'Assigned', 'Completed by', 'Result / value', 'Notes'],
    (wo.checklist ?? []).map((c) => [
      String(c.stepNumber),
      txt(c.stepDescription),
      txt(c.assignedTechnicianNames?.length ? c.assignedTechnicianNames : c.assignedTechnicianName),
      c.isCompleted ? joinFilled([c.completedByName, fmtDateTime(c.completedAt)], '\n') : 'Not completed',
      joinFilled([c.result ? c.result.toUpperCase() : '', c.actualValue != null ? `${c.actualValue}${c.unit ? ` ${c.unit}` : ''}` : '']),
      txt([c.completionNote, c.repairNote].filter(Boolean).join(' / ')),
    ]),
  );

  d.tableSection(
    'Individual completions',
    ['Person', 'Hours', 'Work done', 'Steps completed', 'Completed at'],
    (wo.assigneeCompletions ?? []).map((a) => [
      `${a.technicianName}${a.technicianRole ? ` (${label(USER_ROLE_LABELS, a.technicianRole)})` : ''}`,
      txt(a.hoursWorked),
      txt(a.workDoneDescription),
      txt(a.completedStepsDescription),
      fmtDateTime(a.completedAt),
    ]),
  );

  d.tableSection(
    'Technician work logs',
    ['Person', 'Hours', 'Tasks'],
    (wo.technicianWorkLogs ?? []).map((l) => [
      `${l.technicianName}${l.technicianRole ? ` (${label(USER_ROLE_LABELS, l.technicianRole)})` : ''}`,
      txt(l.hoursWorked),
      txt(l.tasksDescription),
    ]),
  );

  const parts = wo.partsUsed ?? [];
  d.tableSection(
    'Parts used',
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
  const partsCost = wo.totalPartsCost ?? (parts.length ? partsTotal : null);
  const totalCost = wo.totalProjectCost ?? (partsCost != null || wo.projectCost != null ? (partsCost ?? 0) + (wo.projectCost ?? 0) : null);
  d.kvSection('Costs', [
    ['Parts cost', partsCost ? money(partsCost) : '-'],
    ['Project / contractor cost', wo.projectCost ? money(wo.projectCost) : '-'],
    ['Total cost', totalCost ? money(totalCost) : '-'],
  ]);

  d.tableSection(
    'Parts requests',
    ['Part', 'Qty', 'Requested by', 'Status', 'Note'],
    (wo.partsRequests ?? []).map((p) => [
      `${txt(p.partName)}${p.partNumber ? ` (${p.partNumber})` : ''}`,
      `${txt(p.quantity)} ${p.unit ?? ''}`.trim(),
      joinFilled([p.requestedByName, fmtDateTime(p.requestedAt)], '\n'),
      txt(p.status),
      txt(p.rejectedReason ?? p.note),
    ]),
  );

  d.tableSection(
    'Approval requests',
    ['Requested by', 'Note', 'Status', 'Resolved by', 'Resolution'],
    (wo.approvalRequests ?? []).map((a) => [
      joinFilled([a.technicianName, fmtDateTime(a.requestedAt)], '\n'),
      txt(a.note),
      txt(a.status),
      a.resolvedByName ? joinFilled([a.resolvedByName, fmtDateTime(a.resolvedAt)], '\n') : '-',
      txt(a.resolutionNote),
    ]),
  );

  d.tableSection(
    'Post-repair checklist',
    ['Step', 'Result', 'Notes'],
    (wo.postRepairChecklist ?? []).map((p) => [
      txt(p.stepDescription),
      p.result ? p.result.toUpperCase() : p.isCompleted ? 'Done' : 'Not done',
      txt(p.notes),
    ]),
  );

  const rating = wo.contractorRating as unknown as Record<string, unknown> | null | undefined;
  d.kvSection('Contractor', [
    ['Hours on site', txt(wo.contractorHoursLog?.hoursOnSite)],
    ['Hours billed', txt(wo.contractorHoursLog?.hoursBilled)],
    ['Notes', txt(wo.contractorHoursLog?.notes)],
    ...(rating
      ? Object.entries(rating)
          .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
          .map(([k, v]) => [`Rating - ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`, txt(v)] as Row)
      : []),
  ]);

  d.kvSection('Sign-off', [
    ['Signed off by', txt(wo.supervisorSignOffByName)],
    ['Signed off at', fmtDateTime(wo.supervisorSignOffAt)],
    ['Outcome', label(OUTCOME_LABELS, wo.signOffOutcome)],
    ['Outcome reason', txt(wo.signOffOutcomeReason)],
    ['Sign-off notes', txt(wo.supervisorSignOffNotes)],
    ['Closed', wo.closedAt ? joinFilled([fmtDateTime(wo.closedAt), wo.closedByName ? `by ${wo.closedByName}` : null], ' ') : '-'],
  ]);

  if (wo.aiRca && wo.aiRca.source === 'ai') {
    d.kvSection('Root-cause analysis - by AI', [
      ['RCA performed by', joinFilled(['AI (FirmiCore AI assistant)', fmtDateTime(wo.aiRca.generatedAt)])],
      ['Summary', txt(wo.aiRca.summary)],
      ['Root cause', txt(wo.aiRca.rootCause)],
      ['Category', label(ROOT_CAUSE_LABELS, wo.aiRca.rootCauseCategory)],
      ['Contributing factors', txt(wo.aiRca.contributingFactors)],
      ['Evidence', txt(wo.aiRca.evidence)],
      ['Preventive actions', txt(wo.aiRca.preventiveActions)],
      ['Confidence', txt(wo.aiRca.confidence)],
    ]);
  }

  d.tableSection(
    'Status history',
    ['When', 'Status', 'By', 'Note'],
    (wo.statusHistory ?? []).map((h) => [
      fmtDateTime(h.changedAt),
      label(WO_STATUS_LABELS, h.status),
      txt(h.changedByName),
      txt(h.note),
    ]),
  );

  d.tableSection(
    'Documents',
    ['Name', 'Uploaded by', 'Uploaded at'],
    (wo.documents ?? []).map((doc) => [txt(doc.name), txt(doc.uploadedByName), fmtDateTime(doc.uploadedAt)]),
  );

  await d.photos('Completion photos', wo.finalPhotos ?? []);

  d.save(`${wo.woNumber || 'work-order'}.pdf`);
}

// ---------------------------------------------------------------------------
// Breakdown
// ---------------------------------------------------------------------------

export async function exportBreakdownPdf(b: Breakdown, extra?: { linkedWoNumber?: string | null }): Promise<void> {
  const rcaDoc = await loadRca('breakdownId', b.id);
  const d = new Doc();
  await d.header(
    `Breakdown Report - ${b.ticketNumber}`,
    joinFilled([label(BREAKDOWN_STATUS_LABELS, b.status), txt(b.machineName), txt(b.machineDepartment)], '   ·   '),
  );

  const downtime = minutesBetween(b.reportedAt, b.closedAt ?? b.resolvedAt);

  d.kvSection('Summary', [
    ['Ticket number', txt(b.ticketNumber)],
    ['Status', label(BREAKDOWN_STATUS_LABELS, b.status)],
    ['Machine', txt(b.machineName)],
    ['Department', txt(b.machineDepartment)],
    ['Location', txt(b.machineLocation)],
    ['Machine criticality', txt(b.machineCriticality)],
    ['Severity', label(BREAKDOWN_SEVERITY_LABELS, b.severity)],
    ['Type', label(BREAKDOWN_TYPE_LABELS, b.type)],
    ['Source', label(BREAKDOWN_SOURCE_LABELS, b.source)],
    ['Reported', joinFilled([fmtDateTime(b.reportedAt), b.reporterName ? `by ${b.reporterName}` : null], ' ')],
    ['Machine still running', b.machineStillRunning == null ? '-' : b.machineStillRunning ? 'Yes' : 'No'],
    ['Production impact', txt(b.productionImpact)],
    ['Production hours lost', txt(b.productionHoursLost)],
    ['Total downtime', fmtMinutes(downtime)],
    ['SLA deadline', filled(fmtDateTime(b.slaDeadline)) ? `${fmtDateTime(b.slaDeadline)}${b.slaBreached ? ' (breached)' : ''}` : '-'],
    ['Recurring', b.isRecurringFlag ? 'Yes' : '-'],
    ['Linked work order', txt(extra?.linkedWoNumber ?? (b.linkedWOId ? b.linkedWOId : null))],
  ]);

  d.kvSection('Problem', [
    ['Description', txt(b.description)],
    ['Attempted fixes', txt(b.attemptedFixes)],
    ['Technician findings', txt(b.technicianFindings)],
  ]);

  d.kvSection('Assignment', [
    ['Assigned technicians', txt(b.assignedTechnicianNames)],
    ['Assigned by', b.assignedByName ? joinFilled([b.assignedByName, fmtDateTime(b.assignedAt)]) : '-'],
    ['Attended by', b.attendedByName ? joinFilled([b.attendedByName, fmtDateTime(b.attendedAt)]) : '-'],
    ['Contractor assigned', b.assignedContractorId ? 'Yes' : '-'],
  ]);

  d.kvSection('Timeline', [
    ['Reported', fmtDateTime(b.reportedAt)],
    ['Acknowledged', fmtDateTime(b.acknowledgedAt)],
    ['Assigned', fmtDateTime(b.assignedAt)],
    ['En route', fmtDateTime(b.enRouteAt)],
    ['Repair started', fmtDateTime(b.repairStartedAt)],
    ['Resolved', fmtDateTime(b.resolvedAt)],
    ['Closed', fmtDateTime(b.closedAt)],
  ]);

  const hasResolution =
    (!!b.rootCause && b.rootCause !== 'unknown') || filled(b.rootCauseDescription) || filled(b.correctiveActions) || filled(b.preventiveRecommendations);
  d.kvSection('Resolution', [
    ['Root cause', b.rootCause === 'unknown' && !filled(b.rootCauseDescription) ? '-' : label(ROOT_CAUSE_LABELS, b.rootCause)],
    ['Root cause details', txt(b.rootCauseDescription)],
    ['Corrective actions', txt(b.correctiveActions)],
    ['Preventive recommendations', txt(b.preventiveRecommendations)],
    ['RCA performed by', rcaDoc
      ? joinFilled([`Human - ${txt(rcaDoc.createdByName)}`, '5-Whys analysis', fmtDateTime(rcaDoc.createdAt)])
      : hasResolution ? 'Human' : '-'],
  ]);

  if (rcaDoc) {
    d.tableSection(
      'Root-cause analysis (5-Whys) - by a person',
      ['#', 'Question', 'Answer'],
      (rcaDoc.whys ?? []).filter((w) => filled(w.answer)).map((w, i) => [String(i + 1), txt(w.question), txt(w.answer)]),
    );
    d.keyValues([
      ['Problem', txt(rcaDoc.problem)],
      ['Root cause', txt(rcaDoc.rootCause)],
      ['Corrective action', txt(rcaDoc.correctiveAction)],
      ['Status', txt(rcaDoc.status)],
    ]);
  }

  d.tableSection(
    'Status history',
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
