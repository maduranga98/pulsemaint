import type { ExportFormat } from '../../../types/reports.types';

interface ReportFormatChipProps {
  format: ExportFormat | 'pdf' | 'excel' | 'google_sheets';
  label?: string;
}

const styleMap: Record<ExportFormat, string> = {
  pdf: 'bg-red-500/10 text-red-300 border-red-500/30',
  excel: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  google_sheets: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
};

const labelMap: Record<ExportFormat, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  google_sheets: 'Sheets',
};

export default function ReportFormatChip({ format, label }: ReportFormatChipProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styleMap[format]}`}>
      {label ?? labelMap[format]}
    </span>
  );
}
