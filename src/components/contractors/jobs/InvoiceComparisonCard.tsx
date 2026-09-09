import { useTranslation } from 'react-i18next';
import type { Contractor, ContractorJob } from '@/lib/contractors/contractorTypes';
import { calculateSystemInvoice, calculateVariance, formatLkr } from '@/lib/contractors/invoiceCalculator';
import InvoiceVarianceBadge from './InvoiceVarianceBadge';

interface InvoiceComparisonCardProps {
  job: ContractorJob;
  contractor?: Contractor | null;
}

export function InvoiceComparisonCard({ job, contractor }: InvoiceComparisonCardProps) {
  const { t } = useTranslation();
  const system = contractor ? calculateSystemInvoice(job, contractor) : null;
  const variance = system && typeof job.contractorInvoiceAmount === 'number'
    ? calculateVariance(system.total, job.contractorInvoiceAmount)
    : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.invoiceComparison.title')}</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">{t('common.contractors.jobs.invoiceComparison.systemInvoice.title')}</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><dt>{t('common.contractors.jobs.invoiceComparison.systemInvoice.labor')}</dt><dd>{system ? t('common.contractors.jobs.invoiceComparison.systemInvoice.laborValue', { hours: system.laborHours, rate: formatLkr(system.laborRate) }) : '-'}</dd></div>
            <div className="flex justify-between"><dt>{t('common.contractors.jobs.invoiceComparison.systemInvoice.laborCost')}</dt><dd>{formatLkr(system?.laborCost)}</dd></div>
            <div className="flex justify-between"><dt>{t('common.contractors.jobs.invoiceComparison.systemInvoice.factoryParts')}</dt><dd>{formatLkr(system?.partsCost)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-950"><dt>{t('common.contractors.jobs.invoiceComparison.systemInvoice.systemTotal')}</dt><dd>{formatLkr(system?.total)}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">{t('common.contractors.jobs.invoiceComparison.contractorInvoice.title')}</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><dt>{t('common.contractors.jobs.invoiceComparison.contractorInvoice.reference')}</dt><dd>{job.contractorInvoiceRef ?? '-'}</dd></div>
            <div className="flex justify-between"><dt>{t('common.contractors.jobs.invoiceComparison.contractorInvoice.date')}</dt><dd>{job.contractorInvoiceDate ? job.contractorInvoiceDate.toDate().toLocaleDateString() : '-'}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-950"><dt>{t('common.contractors.jobs.invoiceComparison.contractorInvoice.invoiceTotal')}</dt><dd>{formatLkr(job.contractorInvoiceAmount)}</dd></div>
          </dl>
        </div>
      </div>
      {variance && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">{t('common.contractors.jobs.invoiceComparison.variance.label', { amount: formatLkr(variance.amount) })}</p>
            <p className="text-sm text-slate-500">
              {variance.direction === 'match'
                ? t('common.contractors.jobs.invoiceComparison.variance.match')
                : t('common.contractors.jobs.invoiceComparison.variance.mismatch', { direction: variance.direction, percent: variance.percent })}
            </p>
          </div>
          <InvoiceVarianceBadge percent={variance.percent} />
        </div>
      )}
    </section>
  );
}

export default InvoiceComparisonCard;
