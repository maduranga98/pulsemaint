import type { ReportConfig } from '../../../types/reports.types';

export default function PdfOptionsSection({
  config,
  onChange,
}: {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}) {
  if (config.outputFormat !== 'pdf') return null;

  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className="font-[Sora] text-sm font-semibold text-[#F0F4F8]">PDF Options</h3>
      <label className="flex min-h-11 items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
        Include charts
        <input type="checkbox" checked={config.includeCharts} onChange={(event) => onChange({ includeCharts: event.target.checked })} className="h-4 w-4 accent-[#1A56DB]" />
      </label>
      <label className="flex min-h-11 items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
        Include raw data table
        <input type="checkbox" checked={config.includeDataTable} onChange={(event) => onChange({ includeDataTable: event.target.checked })} className="h-4 w-4 accent-[#1A56DB]" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          Paper size
          <select value={config.paperSize} onChange={(event) => onChange({ paperSize: event.target.value as ReportConfig['paperSize'] })} className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
            <option>A4</option>
            <option>Letter</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          Orientation
          <select value={config.orientation} onChange={(event) => onChange({ orientation: event.target.value as ReportConfig['orientation'] })} className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
      </div>
    </section>
  );
}
