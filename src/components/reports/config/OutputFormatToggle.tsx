import type { ExportFormat, ReportDefinition, ReportConfig } from '../../../types/reports.types';

const options: { value: ExportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'google_sheets', label: 'Google Sheets' },
];

export default function OutputFormatToggle({
  report,
  config,
  onChange,
}: {
  report: ReportDefinition;
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}) {
  const supported = (format: ExportFormat) =>
    format === 'pdf' ? report.supportsPdf : format === 'excel' ? report.supportsExcel : report.supportsSheets;

  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className="font-[Sora] text-sm font-semibold text-[#F0F4F8]">Output Format</h3>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={!supported(option.value)}
            onClick={() => onChange({ outputFormat: option.value })}
            className={`min-h-11 rounded-lg border px-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              config.outputFormat === option.value
                ? 'border-[#00C2FF] bg-[#00C2FF]/10 text-[#F0F4F8]'
                : 'border-[#1E3A5F] bg-[#0A1628] text-[#8BA3BF] hover:border-[#2E5A8F]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
