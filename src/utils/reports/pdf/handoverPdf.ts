import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ShiftHandover } from '@/types/handover.types';
import { formatDuration, formatTimeRange } from '@/utils/handover.utils';
import { useAuthStore } from '@/store/authStore';
import { imageFormatFromDataUrl } from '@/lib/pdf/logoUtils';

// SUP-024: shift-handover exports used to build an ad-hoc HTML print window
// (see HandoverDetailPage's old handleExportPdf), which produced a
// differently themed document than every other export in the app. This
// reuses the same jsPDF header/table theme as
// src/utils/reports/pdf/genericReportPdf.ts (title, gray metadata line,
// dark autoTable header) so a "Shift Handover" PDF looks like every other
// FirmiCore report export.

const HEADER_FILL: [number, number, number] = [10, 22, 40];

function fmt(value: Date | null | undefined): string {
  if (!value) return '-';
  try {
    return value.toLocaleString();
  } catch {
    return '-';
  }
}

/** Builds a standard-theme PDF for a single shift handover and triggers a download. */
export function exportHandoverPdf(handover: ShiftHandover): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const company = useAuthStore.getState().company;
  if (company?.logoDataUrl) {
    try {
      doc.addImage(company.logoDataUrl, imageFormatFromDataUrl(company.logoDataUrl), pageWidth - 40 - 36, 20, 36, 36);
    } catch {
      // Malformed/unsupported image data — skip the logo rather than fail the export.
    }
  }

  // Header — same layout as genericReportPdf: 16pt title, gray 10pt metadata lines.
  doc.setFontSize(16);
  doc.text(`${handover.shiftName} Shift Handover`, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Shift date: ${handover.shiftDate}`, 40, 58);
  doc.text(
    `Shift started: ${fmt(handover.shiftActualStart)}   ·   Shift ended: ${fmt(handover.shiftActualEnd)}`,
    40,
    72,
  );
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 86);
  doc.setTextColor(0);

  let y = 105;

  const assignedShift = handover.scheduledStart && handover.scheduledEnd
    ? `${formatTimeRange(handover.scheduledStart, handover.scheduledEnd)} (${handover.scheduledMinutes != null ? formatDuration(handover.scheduledMinutes * 60000) : '-'})`
    : '-';

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Supervisor', handover.outgoingSupervisorName || '-'],
      ['Assigned shift', assignedShift],
      ['Scheduled minutes', handover.scheduledMinutes != null ? String(handover.scheduledMinutes) : '-'],
      ['Actual minutes worked', handover.totalMinutes != null ? String(handover.totalMinutes) : '-'],
      ['Overtime', handover.otMinutes != null ? formatDuration(handover.otMinutes * 60000) : '-'],
      ['Late start', handover.overlapMinutes ? `${formatDuration(handover.overlapMinutes * 60000)} late` : 'On time'],
    ],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: HEADER_FILL, textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  const section = (title: string, head: string[], rows: string[][]) => {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = 40;
    }
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(title, 40, y);
    y += 8;
    if (rows.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('None', 40, y + 12);
      doc.setTextColor(0);
      y += 26;
      return;
    }
    autoTable(doc, {
      startY: y + 6,
      head: [head],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: HEADER_FILL, textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  };

  section(
    'Watch Machine Flags',
    ['Machine', 'Location', 'Level', 'Reason', 'Recommended Action', 'Linked Breakdown'],
    handover.watchFlags.map((f) => [
      f.machineName,
      f.machineLocation || '-',
      f.watchLevel.replace(/_/g, ' '),
      f.reason,
      f.recommendedAction,
      f.linkedBreakdownTicketNumber
        ? `${f.linkedBreakdownTicketNumber}${f.linkedBreakdownType ? ` (${f.linkedBreakdownType.replace(/_/g, ' ')})` : ''}`
        : '-',
    ]),
  );

  section(
    'Work Orders During Shift',
    ['WO #', 'Machine', 'Status', 'Priority', 'Assigned To'],
    handover.pendingWOs.map((w) => [w.woNumber, w.machineName, w.currentStatus, w.priority, w.assignedTechnician || '-']),
  );

  section(
    'Breakdowns During Shift',
    ['Ticket #', 'Machine', 'Severity', 'State', 'Assigned To'],
    handover.ongoingBreakdowns.map((b) => [b.ticketNumber, b.machineName, b.severity, b.currentState, b.assignedTechnician || '-']),
  );

  section(
    'Safety & Notes',
    ['Field', 'Details'],
    [
      ['Safety incident', handover.safetyIncidentOccurred ? (handover.safetyIncidentDescription || 'Reported') : 'None'],
      ['Restricted areas', handover.restrictedAreas || '-'],
      ['Temporary repairs', handover.temporaryRepairs || '-'],
      ['General notes', handover.generalNotes || '-'],
    ],
  );

  // Footer page numbers, matching the rest of the app's report exports.
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 80, doc.internal.pageSize.getHeight() - 20);
  }

  const filename = `FirmiCore_ShiftHandover_${handover.shiftName}_${handover.shiftDate}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  doc.save(filename);
}

export default exportHandoverPdf;
