import { jsPDF } from 'jspdf';

export interface BillingInvoiceInput {
  invoiceNumber: string;
  invoiceDate: Date;

  billedCompanyName: string;
  billedCompanyAddress?: string | null;
  billedCompanyEmail?: string | null;
  attentionName?: string | null;

  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  discountApplied: boolean;
  discountPercent: number;

  paymentMethodLabel?: string | null;
}

const INK = { r: 15, g: 23, b: 42 };
const MUTED = { r: 100, g: 116, b: 139 };
const NAVY = { r: 30, g: 58, b: 95 };

/**
 * Builds a PulseMaint subscription invoice for the given plan change —
 * vendor letterhead ("PulseMaint"), bill-to block, a single line item for
 * the plan/cycle, and the total due.
 */
export function buildBillingInvoicePdf(input: BillingInvoiceInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 56;
  let y = 64;

  // Vendor letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('PulseMaint', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('Maintenance Management Platform · billing@pulsemaint.com', marginX, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text('INVOICE', pageWidth - marginX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`#${input.invoiceNumber}`, pageWidth - marginX, y + 16, { align: 'right' });
  doc.text(
    input.invoiceDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    pageWidth - marginX,
    y + 30,
    { align: 'right' }
  );

  y += 56;
  doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, pageWidth - marginX, y);

  // Bill to
  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('BILL TO', marginX, y);

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(input.billedCompanyName || 'Company', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  if (input.attentionName) {
    y += 15;
    doc.text(`Attn: ${input.attentionName}`, marginX, y);
  }
  if (input.billedCompanyAddress) {
    y += 15;
    doc.text(input.billedCompanyAddress, marginX, y, { maxWidth: pageWidth - marginX * 2 });
  }
  if (input.billedCompanyEmail) {
    y += 15;
    doc.text(input.billedCompanyEmail, marginX, y);
  }

  // Line item table
  y += 36;
  const col1 = marginX;
  const col2 = pageWidth - marginX - 160;
  const col3 = pageWidth - marginX;

  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.rect(marginX, y, pageWidth - marginX * 2, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DESCRIPTION', col1 + 8, y + 16);
  doc.text('BILLING CYCLE', col2, y + 16);
  doc.text('AMOUNT', col3 - 8, y + 16, { align: 'right' });

  y += 24;
  const rowHeight = 30;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + rowHeight, pageWidth - marginX, y + rowHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.text(`PulseMaint ${input.planName} Plan Subscription`, col1 + 8, y + 19);
  doc.text(input.billingCycle === 'yearly' ? 'Yearly' : 'Monthly', col2, y + 19);
  doc.text(`${input.currency} ${input.amount.toFixed(2)}`, col3 - 8, y + 19, { align: 'right' });

  y += rowHeight + 20;

  if (input.discountApplied) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(16, 122, 87);
    doc.text(
      `Includes ${input.discountPercent}% saved-card discount.`,
      col1,
      y
    );
    y += 18;
  }

  // Total
  doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setLineWidth(1);
  doc.line(col2 - 20, y, pageWidth - marginX, y);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('Total Due', col2 - 20, y);
  doc.text(`${input.currency} ${input.amount.toFixed(2)}`, col3, y, { align: 'right' });

  if (input.paymentMethodLabel) {
    y += 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`Charged to ${input.paymentMethodLabel}`, col2 - 20, y);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(
    'This is a system-generated invoice for your PulseMaint subscription. For billing questions, contact billing@pulsemaint.com.',
    marginX,
    pageHeight - 48,
    { maxWidth: pageWidth - marginX * 2 }
  );

  return doc;
}
