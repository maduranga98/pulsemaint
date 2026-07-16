import { CalendarClock, FileSpreadsheet, FileText, X } from 'lucide-react';
import { REPORT_DEFINITIONS } from '../../utils/reports/reportDefinitions';
import { useReportGeneration } from '../../hooks/reports/useReportGeneration';
import { useReportsStore } from '../../store/reports.store';
import DateRangeSelector from './config/DateRangeSelector';
import GenerationErrorState from './generation/GenerationErrorState';
import GenerationProgressBar from './generation/GenerationProgressBar';
import GenerationStatusMessage from './generation/GenerationStatusMessage';
import GoogleSheetsConnector from './config/GoogleSheetsConnector';
import OutputFormatToggle from './config/OutputFormatToggle';
import PdfOptionsSection from './config/PdfOptionsSection';
import ReportFilterSection from './config/ReportFilterSection';
import ReportReadyActions from './generation/ReportReadyActions';
import ReportPreview from './ReportPreview';
import { useAuthStore } from '../../store/authStore';

export default function ReportConfigPanel() {
  const selectedReportType = useReportsStore((state) => state.selectedReportType);
  const isOpen = useReportsStore((state) => state.isConfigPanelOpen);
  const close = useReportsStore((state) => state.closeConfigPanel);
  const config = useReportsStore((state) => state.config);
  const updateConfig = useReportsStore((state) => state.updateConfig);
  const { generationStatus, generationProgress, generationError, lastDownloadUrl, lastSheetsUrl, generatePdf, exportExcel, pushToSheets, isGenerating } = useReportGeneration();
  const companyId = useAuthStore((state) => state.company?.id ?? state.userProfile?.companyId ?? '');

  if (!isOpen || !selectedReportType) return null;
  const report = REPORT_DEFINITIONS[selectedReportType];

  // The output format is already chosen once via OutputFormatToggle above —
  // the footer must act on that single selection instead of listing the
  // same PDF/Excel/Sheets options again as three separate buttons.
  const formatSupported =
    config.outputFormat === 'pdf' ? report.supportsPdf : config.outputFormat === 'excel' ? report.supportsExcel : report.supportsSheets;
  const generateForSelectedFormat =
    config.outputFormat === 'pdf' ? generatePdf : config.outputFormat === 'excel' ? exportExcel : pushToSheets;
  const formatLabel = config.outputFormat === 'pdf' ? 'PDF' : config.outputFormat === 'excel' ? 'Excel' : 'Google Sheets';
  const FormatIcon = config.outputFormat === 'pdf' ? FileText : FileSpreadsheet;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/50">
      <aside className="flex h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#1E3A5F] bg-[#0F1E35] shadow-2xl sm:h-full sm:max-w-[480px] sm:rounded-none">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#1E3A5F] sm:hidden" />
        <header className="flex items-start justify-between gap-3 border-b border-[#1E3A5F] p-5">
          <div>
            <h2 className="font-[Sora] text-lg font-bold text-[#F0F4F8]">{report.name}</h2>
            <p className="mt-1 text-sm text-[#8BA3BF]">Estimated generation: {report.estimatedGenerationSecs}s</p>
          </div>
          <button type="button" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#8BA3BF] hover:bg-[#0A1628] hover:text-[#F0F4F8]" aria-label="Close report panel">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <DateRangeSelector config={config} onChange={updateConfig} />
          <ReportFilterSection report={report} config={config} onChange={updateConfig} />
          <OutputFormatToggle report={report} config={config} onChange={updateConfig} />
          <GoogleSheetsConnector visible={config.outputFormat === 'google_sheets'} />
          <PdfOptionsSection config={config} onChange={updateConfig} />

          <ReportPreview reportType={selectedReportType} config={config} companyId={companyId} />

          <section className="space-y-3">
            <GenerationStatusMessage status={generationStatus} />
            {isGenerating && <GenerationProgressBar progress={generationProgress} />}
            <GenerationErrorState message={generationError} onRetry={config.outputFormat === 'pdf' ? generatePdf : config.outputFormat === 'excel' ? exportExcel : pushToSheets} />
            <ReportReadyActions downloadUrl={lastDownloadUrl} sheetsUrl={lastSheetsUrl} />
          </section>
        </div>

        <footer className="space-y-2 border-t border-[#1E3A5F] p-5">
          <button
            type="button"
            disabled={isGenerating || !formatSupported}
            onClick={generateForSelectedFormat}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-3 text-sm font-semibold text-white transition hover:bg-[#1D64F2] disabled:opacity-50"
          >
            <FormatIcon className="h-4 w-4" />
            {isGenerating ? 'Generating…' : `Generate ${formatLabel}`}
          </button>
          <button type="button" disabled title="Coming Phase 3" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-[#8BA3BF] opacity-70">
            <CalendarClock className="h-4 w-4" />
            Schedule This Report
          </button>
        </footer>
      </aside>
    </div>
  );
}
