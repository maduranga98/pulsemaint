interface InvoiceVarianceBadgeProps {
  percent: number;
}

export function InvoiceVarianceBadge({ percent }: InvoiceVarianceBadgeProps) {
  const flagged = percent >= 10;
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${flagged ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
      {flagged ? `Variance ${percent.toFixed(1)}%` : `Within range ${percent.toFixed(1)}%`}
    </span>
  );
}

export default InvoiceVarianceBadge;
