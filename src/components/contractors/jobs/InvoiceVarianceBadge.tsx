import { useTranslation } from 'react-i18next';

interface InvoiceVarianceBadgeProps {
  percent: number;
}

export function InvoiceVarianceBadge({ percent }: InvoiceVarianceBadgeProps) {
  const { t } = useTranslation();
  const flagged = percent >= 10;
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${flagged ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
      {flagged
        ? t('common.contractors.jobs.invoiceComparison.variance.flagged', { percent: percent.toFixed(1) })
        : t('common.contractors.jobs.invoiceComparison.variance.withinRange', { percent: percent.toFixed(1) })}
    </span>
  );
}

export default InvoiceVarianceBadge;
