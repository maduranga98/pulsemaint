import type { PurchaseOrder } from '@/types/inventory';

function fmtDate(ts: any): string {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  return d ? d.toLocaleDateString() : '—';
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface PrintCompanyMeta {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function buildPOPrintHTML(po: PurchaseOrder, company: PrintCompanyMeta): string {
  const total = po.items.reduce((s, it) => s + it.totalCost, 0);
  const rows = po.items
    .map(
      (it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><div class="mono">${it.partNumber || ''}</div><div>${it.partName || ''}</div></td>
        <td class="right">${it.quantityOrdered}</td>
        <td class="right">${money(it.unitCost, po.currency)}</td>
        <td class="right">${money(it.totalCost, po.currency)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Purchase Order ${po.poNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 28px; margin: 0; letter-spacing: 1px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; }
  .company { font-size: 14px; }
  .company .name { font-weight: 700; font-size: 18px; }
  .po-meta { text-align: right; font-size: 14px; }
  .po-meta .num { font-family: ui-monospace, Menlo, monospace; font-weight: 700; }
  .section { margin-top: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; }
  .card h3 { margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #666; letter-spacing: 0.6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td.right, th.right { text-align: right; }
  .mono { font-family: ui-monospace, Menlo, monospace; color: #2563eb; font-size: 12px; }
  .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
  .totals .box { min-width: 260px; border: 1px solid #111; padding: 12px 16px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .totals .grand { border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 16px; }
  .sign { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  .sign .line { border-top: 1px solid #111; padding-top: 6px; font-size: 12px; color: #555; }
  .notes { white-space: pre-wrap; font-size: 13px; }
  .small { font-size: 12px; color: #555; }
  @media print {
    body { margin: 16mm; }
    .no-print { display: none; }
  }
  .toolbar { position: fixed; bottom: 16px; right: 16px; }
  .toolbar button { background: #2563eb; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      <div class="name">${escape(company.name)}</div>
      ${company.address ? `<div>${escape(company.address)}</div>` : ''}
      ${company.phone ? `<div>Phone: ${escape(company.phone)}</div>` : ''}
      ${company.email ? `<div>Email: ${escape(company.email)}</div>` : ''}
    </div>
    <div class="po-meta">
      <h1>PURCHASE ORDER</h1>
      <div class="num">${escape(po.poNumber)}</div>
      <div>Date: ${fmtDate(po.raisedAt)}</div>
      <div>Status: ${escape(po.status)}</div>
    </div>
  </div>

  <div class="section grid">
    <div class="card">
      <h3>Supplier</h3>
      <div><strong>${escape(po.supplierName)}</strong></div>
      ${po.supplierContactPerson ? `<div>Attn: ${escape(po.supplierContactPerson)}</div>` : ''}
      ${po.supplierPhone ? `<div>Phone: ${escape(po.supplierPhone)}</div>` : ''}
      ${po.supplierEmail ? `<div>Email: ${escape(po.supplierEmail)}</div>` : ''}
      ${po.supplierContact ? `<div class="small">${escape(po.supplierContact)}</div>` : ''}
      ${po.supplierAddress ? `<div class="small" style="margin-top:6px;white-space:pre-wrap">${escape(po.supplierAddress)}</div>` : ''}
    </div>
    <div class="card">
      <h3>Ship To</h3>
      <div class="notes">${escape(po.deliveryAddress || company.address || company.name)}</div>
      ${po.paymentTerms ? `<div style="margin-top:8px"><strong>Payment Terms:</strong> ${escape(po.paymentTerms)}</div>` : ''}
      <div style="margin-top:8px"><strong>Currency:</strong> ${escape(po.currency)}</div>
    </div>
  </div>

  <div class="section">
    <table>
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th>Part</th>
          <th class="right" style="width:90px">Qty</th>
          <th class="right" style="width:140px">Unit Cost</th>
          <th class="right" style="width:160px">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="box">
        <div class="row"><span>Subtotal</span><span>${money(total, po.currency)}</span></div>
        <div class="row grand"><span>Total</span><span>${money(total, po.currency)}</span></div>
      </div>
    </div>
  </div>

  ${po.notes ? `<div class="section card"><h3>Notes</h3><div class="notes">${escape(po.notes)}</div></div>` : ''}

  <div class="sign">
    <div class="line">Prepared by: ${escape(po.raisedByName || '')}${po.raisedByRole ? ` (${escape(po.raisedByRole)})` : ''}</div>
    <div class="line">Approved by: ${escape(po.approvedByName || '')}</div>
  </div>

  <div class="toolbar no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;
}

function escape(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openPOPrintView(po: PurchaseOrder, company: PrintCompanyMeta): void {
  const html = buildPOPrintHTML(po, company);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
