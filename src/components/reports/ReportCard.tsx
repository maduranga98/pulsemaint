import { FileText } from 'lucide-react';
import ReportCategoryIcon from './shared/ReportCategoryIcon';
import ReportFormatChip from './shared/ReportFormatChip';
import type { ReportDefinition } from '../../types/reports.types';

export default function ReportCard({
  report,
  onGenerate,
}: {
  report: ReportDefinition;
  onGenerate: (type: ReportDefinition['type']) => void;
}) {
  return (
    <article className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#2E5A8F]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#1E3A5F] bg-[#0A1628] text-[#00C2FF]">
          <ReportCategoryIcon icon={report.icon} className="h-5 w-5" />
        </div>
        <h3 className="min-w-0 flex-1 truncate font-[Sora] text-base font-semibold text-[#F0F4F8]">{report.name}</h3>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {report.supportsPdf && <ReportFormatChip format="pdf" />}
        {report.supportsExcel && <ReportFormatChip format="excel" />}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onGenerate(report.type)}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D64F2]"
        >
          <FileText className="h-4 w-4" />
          Generate
        </button>
      </div>
    </article>
  );
}
