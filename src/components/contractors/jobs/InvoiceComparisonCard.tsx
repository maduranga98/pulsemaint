import type { Contractor, ContractorJob } from '@/lib/contractors/contractorTypes';
import { calculateSystemInvoice, calculateVariance, formatLkr } from '@/lib/contractors/invoiceCalculator';
import InvoiceVarianceBadge from './InvoiceVarianceBadge';

interface InvoiceComparisonCardProps {
  job: ContractorJob;
  contractor?: Contractor | null;
}

export function InvoiceComparisonCard({ job, contractor }: InvoiceComparisonCardProps) {
  const system = contractor ? calculateSystemInvoice(job, contractor) : null;
  const variance = system && typeof job.contractorInvoiceAmount === 'number'
    ? calculateVariance(system.total, job.contractorInvoiceAmount)
    : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Invoice Comparison</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">System Invoice</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><dt>Labor</dt><dd>{system ? `${system.laborHours}h x ${formatLkr(system.laborRate)}` : '-'}</dd></div>
            <div className="flex justify-between"><dt>Labor cost</dt><dd>{formatLkr(system?.laborCost)}</dd></div>
            <div className="flex justify-between"><dt>Factory parts</dt><dd>{formatLkr(system?.partsCost)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-950"><dt>System total</dt><dd>{formatLkr(system?.total)}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Contractor Invoice</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><dt>Reference</dt><dd>{job.contractorInvoiceRef ?? '-'}</dd></div>
            <div className="flex justify-between"><dt>Date</dt><dd>{job.contractorInvoiceDate ? job.contractorInvoiceDate.toDate().toLocaleDateString() : '-'}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-950"><dt>Invoice total</dt><dd>{formatLkr(job.contractorInvoiceAmount)}</dd></div>
          </dl>
        </div>
      </div>
      {variance && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">Variance: {formatLkr(variance.amount)}</p>
            <p className="text-sm text-slate-500">{variance.direction === 'match' ? 'Invoice matches system calculation.' : `Contractor invoice is ${variance.direction} by ${variance.percent}%.`}</p>
          </div>
          <InvoiceVarianceBadge percent={variance.percent} />
        </div>
      )}
    </section>
  );
}

export default InvoiceComparisonCard;
