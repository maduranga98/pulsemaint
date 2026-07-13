/**
 * Machine export utilities: CSV export for the registry, and client-side PDF
 * generation for machine detail sheets and QR code labels (jsPDF).
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Machine, MachineStatus, MachineType } from '../types/machine';

// ---------------------------------------------------------------------------
// Display formatting ("standard view" labels instead of raw enum values)
// ---------------------------------------------------------------------------

const ACRONYMS = new Set(['cnc', 'hvac']);

export function formatMachineTypeLabel(type: MachineType): string {
  if (!type) return 'Other';
  return type
    .split('_')
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

const STATUS_LABELS: Record<MachineStatus, string> = {
  active: 'Active',
  under_maintenance: 'Under Maintenance',
  decommissioned: 'Decommissioned',
};

export function formatMachineStatusLabel(status: MachineStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Firestore Timestamp (or {seconds}) -> Date, tolerating both shapes. */
export function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  if (value instanceof Date) return value;
  return null;
}

function formatDateCell(value: unknown): string {
  const d = timestampToDate(value);
  return d ? d.toISOString().split('T')[0] : '';
}

function formatWarrantyItems(machine: Machine): string {
  return (machine.warrantyItems ?? [])
    .map((item) => {
      const expiry = formatDateCell(item.expiryDate);
      const parts = [item.partName, expiry ? `expires ${expiry}` : '', item.supplierWarrantyRef]
        .filter(Boolean);
      return parts.join(' - ');
    })
    .join('; ');
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportMachinesToCsv(machines: Machine[]): void {
  const headers = [
    'Name', 'Type', 'Manufacturer', 'Model', 'Serial Number',
    'Department', 'Floor', 'Bay', 'Station',
    'Status', 'Criticality', 'Health Score',
    'Purchase Date', 'Installation Date', 'Next PM Due', 'Last Service Date',
    'Warranty Items', 'Spare Parts', 'Modification Notes', 'Additional Notes',
  ];

  const rows = machines.map((m) => [
    m.name,
    formatMachineTypeLabel(m.type),
    m.manufacturer,
    m.model ?? '',
    m.serialNumber ?? '',
    m.department ?? '',
    m.floor ?? '',
    m.bay ?? '',
    m.station ?? '',
    formatMachineStatusLabel(m.status),
    String(m.criticality),
    String(m.healthScore),
    formatDateCell(m.purchaseDate),
    formatDateCell(m.installationDate),
    formatDateCell(m.nextPmDue),
    formatDateCell(m.lastServiceDate),
    formatWarrantyItems(m),
    (m.compatiblePartIds ?? []).join('; '),
    m.modificationNotes ?? '',
    (m as unknown as { additionalNotes?: string | null }).additionalNotes ?? '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell ?? '')).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `machines_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Machine detail PDF
// ---------------------------------------------------------------------------

function detailRows(pairs: Array<[string, string]>): string[][] {
  return pairs.map(([label, value]) => [label, value || 'N/A']);
}

export function exportMachineDetailsPdf(machine: Machine): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(machine.name, margin, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Machine Details Report', margin, 64);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 64, { align: 'right' });
  doc.setTextColor(0);

  let y = 84;

  const section = (title: string, rows: string[][]) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      head: [],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: 'bold', fillColor: [248, 250, 252] },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = 48;
    }
  };

  section('Machine Information', detailRows([
    ['Name', machine.name],
    ['Type', formatMachineTypeLabel(machine.type)],
    ['Manufacturer', machine.manufacturer],
    ['Model', machine.model ?? ''],
    ['Serial Number', machine.serialNumber ?? ''],
  ]));

  section('Location', detailRows([
    ['Department', machine.department ?? ''],
    ['Floor', machine.floor ?? ''],
    ['Bay', machine.bay ?? ''],
    ['Station', machine.station ?? ''],
  ]));

  section('Status & Health', detailRows([
    ['Status', formatMachineStatusLabel(machine.status)],
    ['Criticality', `${machine.criticality} / 5`],
    ['Health Score', `${machine.healthScore} / 100`],
  ]));

  section('Key Dates', detailRows([
    ['Purchase Date', formatDateCell(machine.purchaseDate)],
    ['Installation Date', formatDateCell(machine.installationDate)],
    ['Last Service Date', formatDateCell(machine.lastServiceDate)],
    ['Last Service Type', machine.lastServiceType ?? ''],
    ['Next PM Due', formatDateCell(machine.nextPmDue)],
    ['Expected Lifespan', machine.expectedLifespanYears ? `${machine.expectedLifespanYears} years` : ''],
  ]));

  const warranty = machine.warrantyItems ?? [];
  if (warranty.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Warranty Items', margin, y);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      head: [['Part Name', 'Expiry Date', 'Supplier Warranty Ref']],
      body: warranty.map((w) => [w.partName, formatDateCell(w.expiryDate), w.supplierWarrantyRef || 'N/A']),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [26, 86, 219] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  }

  const additionalNotes =
    (machine as unknown as { additionalNotes?: string | null }).additionalNotes ?? '';
  section('Notes', detailRows([
    ['Spare Parts', (machine.compatiblePartIds ?? []).join('; ')],
    ['Modification Notes', machine.modificationNotes ?? ''],
    ['Additional Notes', additionalNotes],
  ]));

  const safeName = machine.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  doc.save(`machine_${safeName}_details.pdf`);
}

// ---------------------------------------------------------------------------
// QR code PDF
// ---------------------------------------------------------------------------

export function exportMachineQrPdf(
  machine: Machine,
  qrDataUrl: string,
  qrUrl: string,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PulseMaint', centerX, 30, { align: 'center' });

  doc.setFontSize(16);
  doc.text(machine.name, centerX, 45, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const location = [
    machine.department,
    machine.floor ? `Floor ${machine.floor}` : '',
    machine.bay ? `Bay ${machine.bay}` : '',
    machine.station ? `Station ${machine.station}` : '',
  ].filter(Boolean).join(' · ');
  if (location) doc.text(location, centerX, 52, { align: 'center' });
  doc.setTextColor(0);

  // QR code image, centered
  const qrSize = 100;
  doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, 62, qrSize, qrSize);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to report breakdown', centerX, 172, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Machine ID: ${machine.id}`, centerX, 180, { align: 'center' });
  doc.text(qrUrl, centerX, 186, { align: 'center', maxWidth: pageWidth - 40 });
  doc.setTextColor(0);

  doc.save(`qr_${machine.id}.pdf`);
}
